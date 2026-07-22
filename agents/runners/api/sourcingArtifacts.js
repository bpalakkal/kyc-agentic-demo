import Anthropic from '@anthropic-ai/sdk';

const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v2';

async function firecrawlScrape(body) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is required for browser-source evidence');
  const response = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ onlyMainContent: false, maxAge: 0, timeout: 60_000, ...body }),
    signal: AbortSignal.timeout(75_000),
  });
  if (!response.ok) throw new Error(`Firecrawl scrape HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.success === false) throw new Error(payload.error || 'Firecrawl scrape failed');
  return payload.data ?? payload;
}

export async function captureSourceScreenshot(url, { filenamePrefix, caption } = {}) {
  const payload = await firecrawlScrape({ url, formats: [{ type: 'screenshot', fullPage: true, quality: 85, viewport: { width: 1440, height: 1000 } }] });
  const screenshot = payload.screenshot;
  if (!screenshot) throw new Error('Firecrawl returned no screenshot');
  let content;
  if (screenshot.startsWith('data:')) content = Buffer.from(screenshot.split(',', 2)[1], 'base64');
  else if (/^https?:\/\//i.test(screenshot)) {
    const image = await fetch(screenshot, { signal: AbortSignal.timeout(30_000) });
    if (!image.ok) throw new Error(`Screenshot download HTTP ${image.status}`);
    content = Buffer.from(await image.arrayBuffer());
  } else content = Buffer.from(screenshot, 'base64');
  return {
    filename: `${filenamePrefix || 'source'}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
    mimeType: 'image/png',
    fileCategory: 'screenshot',
    title: caption || 'Source evidence screenshot',
    caption: caption || `Full-page evidence captured from ${url}`,
    sourceUrl: url,
    content,
  };
}

export async function scrapeBrowserEvidence(url, { prompt, schema, filenamePrefix, caption }) {
  const payload = await firecrawlScrape({
    url,
    formats: [
      { type: 'json', prompt, schema },
      { type: 'screenshot', fullPage: true, quality: 85, viewport: { width: 1440, height: 1000 } },
    ],
  });
  const screenshot = payload.screenshot;
  if (!screenshot) throw new Error('Firecrawl returned no screenshot');
  let content;
  if (screenshot.startsWith('data:')) content = Buffer.from(screenshot.split(',', 2)[1], 'base64');
  else if (/^https?:\/\//i.test(screenshot)) {
    const image = await fetch(screenshot, { signal: AbortSignal.timeout(30_000) });
    if (!image.ok) throw new Error(`Screenshot download HTTP ${image.status}`);
    content = Buffer.from(await image.arrayBuffer());
  } else content = Buffer.from(screenshot, 'base64');
  return {
    data: payload.json ?? {},
    screenshot: {
      filename: `${filenamePrefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
      mimeType: 'image/png', fileCategory: 'screenshot', title: caption,
      caption, sourceUrl: url, content,
    },
  };
}

export async function downloadSourceDocument(url, { filename, title, headers = {} } = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Document download HTTP ${response.status} for ${url}`);
  const mimeType = response.headers.get('content-type')?.split(';')[0] || 'application/pdf';
  return {
    filename,
    mimeType,
    fileCategory: 'document',
    title: title ?? filename,
    sourceUrl: url,
    content: Buffer.from(await response.arrayBuffer()),
  };
}

export async function digitizeKycDocument(file, {
  documentType,
  source,
  scalarFields,
  partyRoles = [],
}) {
  if (!file?.content?.length) return { attributes: [], persons: [] };
  const isPdf = file.mimeType === 'application/pdf';
  const isText = /^(text\/|application\/(xhtml\+xml|html|json))/.test(file.mimeType);
  if (!isPdf && !isText) return { attributes: [], persons: [] };
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required for document digitization');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    temperature: 0,
    system: `You extract explicit KYC facts from a ${documentType}. Return JSON only. Never infer a missing value. Use null for unavailable fields.`,
    messages: [{ role: 'user', content: [
      isPdf
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.content.toString('base64') } }
        : { type: 'text', text: `DOCUMENT CONTENT:\n${file.content.toString('utf8').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 180_000)}` },
      { type: 'text', text: `Extract this exact JSON shape:\n${JSON.stringify({
        attributes: Object.fromEntries(scalarFields.map(field => [field, null])),
        persons: partyRoles.map(role => ({ role, records: [] })),
      })}\nEach person record may contain full_name, ownership_pct, nationality, and attributes keyed by canonical snake_case field name.` },
    ] }],
  });
  const text = response.content.find(block => block.type === 'text')?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Digitization returned no JSON for ${file.filename}`);
  const parsed = JSON.parse(match[0]);
  const timestamp = new Date().toISOString();
  const attributes = Object.entries(parsed.attributes ?? {})
    .filter(([, value]) => value !== null && value !== '' && value !== 'N/A')
    .map(([attributeName, value]) => ({
      attributeName,
      attributeGroup: 'core',
      displayValue: typeof value === 'object' ? JSON.stringify(value) : String(value),
      source: `${source} (${documentType})`,
      confidence: 85,
      idFlag: false,
      verificationFlag: false,
      exceptionFlag: false,
      lineage: [{ value, source: `${source} (${documentType})`, source_url: file.sourceUrl, document_id: file.filename, timestamp, confidence_score: 0.85 }],
    }));
  const persons = [];
  for (const group of parsed.persons ?? []) {
    if (!partyRoles.includes(group.role)) continue;
    for (const [index, person] of (group.records ?? []).entries()) {
      persons.push({
        source: `${source} (${documentType})`,
        role: group.role,
        personIndex: index,
        fullName: person.full_name ?? null,
        ownershipPct: Number.isFinite(Number(person.ownership_pct)) ? Number(person.ownership_pct) : null,
        nationality: person.nationality ?? null,
        attributes: person.attributes ?? {},
      });
    }
  }
  return { attributes, persons };
}

/** Keep authoritative structured values and use digitization only to fill gaps. */
export function mergeStructuredAttributes(structured = [], digitized = []) {
  const names = new Set(structured.map(item => item.attributeName));
  return [...structured, ...digitized.filter(item => !names.has(item.attributeName))];
}
