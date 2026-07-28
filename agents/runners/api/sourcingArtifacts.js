import { createClaudeClient } from '../../models/claude.js';

const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v2';

export const DOCUMENT_TYPES = [
  '10K/Annual Report', 'ACRA Report', 'AML Questionaire', 'Annual Return', 'Articles of Association',
  'Articles of Incorporation', 'Articles of Organization', 'Audited Financial Report', 'Auditor Letter',
  'Authorized signers list', 'Bankruptcy Filing', 'Board Resolution', 'Certificate of Formation',
  'Certificate of Incorporation', 'Certificate of Incumbency', 'Certificate of Name Change',
  'CIP Reliance Agreement', 'Client Confirmation', 'Client Representation Letter', 'Declaration of Trust',
  'Drivers License', 'Dun and Bradstreet Report', 'Factsheet', 'FINRA Broker Check Report', 'Form 5500',
  'Form 990', 'FundSquare Key Information Document', 'Government Photo ID', 'Handelsregister Extract',
  'ICRIS Report', 'Investment Management Agreement', 'IRS Letter', 'LLC/LP Operating Agreement',
  'Memorandum of Association', 'New Relationship Form', 'Offering Memorandum',
  'Organizational Structure Document', 'Other', 'Partnership agreement', 'Passport', 'Power of Attorney',
  'Private Placement Memorandum', 'Prospectus', 'RCS Extract', 'Registration Certificate', 'SEC Form ADV',
  'Share Register', 'Trust Agreement', 'USA PATRIOT Act Certification', 'W9', 'Wolfsberg Questionnaire',
  'WorldCheck Report', 'N/A', 'Unknown',
];

function documentContentBlock(file) {
  if (file.mimeType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.content.toString('base64') } };
  }
  if (/^(text\/|application\/(xhtml\+xml|html|json))/.test(file.mimeType)) {
    return { type: 'text', text: `DOCUMENT CONTENT:\n${file.content.toString('utf8').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 180_000)}` };
  }
  if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.mimeType)) {
    return { type: 'image', source: { type: 'base64', media_type: file.mimeType, data: file.content.toString('base64') } };
  }
  return null;
}

export async function classifyKycDocument(file, { modelProfileKey = 'bedrock-claude-haiku' } = {}) {
  const content = documentContentBlock(file);
  if (!content) return { documentType: 'Unknown', reason: `Unsupported MIME type: ${file.mimeType}`, confidence: 0 };
  const client = createClaudeClient(modelProfileKey);
  const response = await client.messages.create({
    model: client.profile.modelId, max_tokens: 1024, temperature: 0,
    system: 'You are the authoritative KYC document classifier. Classify from explicit content only. Assign exactly one allowed type. Use Other when readable content is ambiguous and Unknown only when it cannot be read. Return JSON only.',
    messages: [{ role: 'user', content: [content, { type: 'text', text: `File name: ${file.filename}\nAllowed document_type values:\n${DOCUMENT_TYPES.join('\n')}\nReturn {"document_type":"...","reason":"brief explicit content evidence","confidence":0-100}.` }] }],
  });
  const text = response.content.find(block => block.type === 'text')?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Classifier returned no JSON for ${file.filename}`);
  const parsed = JSON.parse(match[0]);
  const documentType = DOCUMENT_TYPES.includes(parsed.document_type) ? parsed.document_type : 'Other';
  return { documentType, reason: String(parsed.reason ?? ''), confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)) };
}

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

async function firecrawlBrowserRequest(path, { method = 'POST', body, timeout = 75_000 } = {}) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is required for browser-source evidence');
  const response = await fetch(`${FIRECRAWL_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`Firecrawl browser HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.success === false) throw new Error(payload.error || 'Firecrawl browser request failed');
  return payload;
}

function evidenceLines(details) {
  if (!details) return [];
  if (Array.isArray(details)) return details.map(String).filter(Boolean);
  return Object.entries(details).filter(([, value]) => value != null && String(value).trim())
    .map(([key, value]) => `${key.replaceAll('_', ' ')}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
}

export async function captureBrowserSessionScreenshot(sessionId, {
  entityName, sourceName, outcome, outcomeReason, details, filename, title, caption, sourceUrl,
} = {}) {
  const summary = {
    entityName: String(entityName || 'Unknown entity'),
    sourceName: String(sourceName || 'Source registry'),
    outcome: outcome === 'data_found' ? 'DATA FOUND' : 'NO DATA FOUND',
    outcomeReason: String(outcomeReason || ''),
    details: evidenceLines(details),
    capturedAt: new Date().toISOString(),
  };
  const code = `
const evidence = ${JSON.stringify(summary)};
await page.evaluate((evidence) => {
  document.getElementById('__kyc_evidence_banner__')?.remove();
  const banner = document.createElement('section');
  banner.id = '__kyc_evidence_banner__';
  banner.setAttribute('data-kyc-evidence', 'true');
  Object.assign(banner.style, { position: 'relative', zIndex: '2147483647', boxSizing: 'border-box', width: '100%', padding: '20px 28px', background: evidence.outcome === 'DATA FOUND' ? '#ecfdf5' : '#fff7ed', color: '#111827', borderBottom: '4px solid ' + (evidence.outcome === 'DATA FOUND' ? '#059669' : '#ea580c'), fontFamily: 'Arial, sans-serif' });
  const line = (label, value) => '<div style="margin:4px 0"><strong>' + label + ':</strong> ' + String(value).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) + '</div>';
  banner.innerHTML = '<div style="font-size:20px;font-weight:700;margin-bottom:8px">KYC Source Evidence — ' + evidence.outcome + '</div>' + line('Entity searched', evidence.entityName) + line('Source', evidence.sourceName) + line('Captured', evidence.capturedAt) + (evidence.outcomeReason ? line('Result', evidence.outcomeReason) : '') + evidence.details.map(item => line('Captured field', item)).join('');
  document.body.prepend(banner);
}, evidence);
await page.waitForTimeout(300);
const image = await page.screenshot({ fullPage: true, type: 'png' });
image.toString('base64');
`;
  const execution = await firecrawlBrowserRequest(`/browser/${encodeURIComponent(sessionId)}/execute`, {
    body: { code, language: 'node', timeout: 90 }, timeout: 105_000,
  });
  if (!execution.success || execution.exitCode !== 0 || execution.killed || execution.error) {
    throw new Error(`Firecrawl evidence screenshot execution failed: ${execution.error || execution.stderr || `exit ${execution.exitCode}`}`);
  }
  const result = String(execution.result ?? '').trim();
  const stdout = String(execution.stdout ?? '');
  const marker = '__KYC_SCREENSHOT__';
  // Current Firecrawl browser sessions return the final Node expression in
  // `result`. Continue accepting the old marker-in-stdout format so sessions
  // running against an older browser backend still work.
  const encoded = result || (stdout.includes(marker)
    ? stdout.slice(stdout.lastIndexOf(marker) + marker.length).trim().split(/\s/)[0]
    : '');
  if (!encoded) throw new Error('Firecrawl browser returned no evidence screenshot data');
  const content = Buffer.from(encoded, 'base64');
  if (content.length < 5_000 || content.subarray(1, 4).toString('ascii') !== 'PNG') throw new Error('Evidence screenshot was empty or invalid');
  return {
    filename: filename || `source-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
    mimeType: 'image/png', fileCategory: 'screenshot', title: title || `${summary.sourceName} evidence - ${summary.entityName}`,
    caption: caption || `${summary.outcome}: ${summary.entityName}`, sourceUrl, content,
  };
}

export async function captureSourceScreenshot(url, options = {}) {
  const session = await firecrawlBrowserRequest('/browser', { body: { ttl: 150, activityTtl: 150, streamWebView: false } });
  if (!session.id) throw new Error('Firecrawl did not create an evidence browser session');
  try {
    await firecrawlBrowserRequest(`/browser/${encodeURIComponent(session.id)}/execute`, {
      body: { code: `await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForTimeout(3000);`, language: 'node', timeout: 75 }, timeout: 90_000,
    });
    return await captureBrowserSessionScreenshot(session.id, {
      ...options, sourceUrl: url,
      filename: options.filename || `${options.filenamePrefix || 'source'}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
    });
  } finally {
    await firecrawlBrowserRequest(`/browser/${encodeURIComponent(session.id)}`, { method: 'DELETE', timeout: 30_000 }).catch(() => {});
  }
}

export async function scrapeBrowserEvidence(url, { prompt, schema, filename, title, filenamePrefix, caption }) {
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
    json: payload.json ?? {},
    screenshot: {
      filename: filename || `${filenamePrefix || 'source'}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
      mimeType: 'image/png', fileCategory: 'screenshot', title: title || caption,
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
  modelProfileKey = 'bedrock-claude-haiku',
}) {
  if (!file?.content?.length) return { attributes: [], persons: [] };
  const content = documentContentBlock(file);
  if (!content) return { attributes: [], persons: [] };
  const client = createClaudeClient(modelProfileKey);
  const response = await client.messages.create({
    model: client.profile.modelId,
    max_tokens: 8192,
    temperature: 0,
    system: `You extract explicit KYC facts from a ${documentType}. Return JSON only. Never infer a missing value. Use null for unavailable fields.`,
    messages: [{ role: 'user', content: [
      content,
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
      const wrappedAttributes = Object.fromEntries(Object.entries(person.attributes ?? {})
        .filter(([, value]) => value !== null && value !== '' && value !== 'N/A')
        .map(([name, value]) => [name, {
          id_flag: false, verification_flag: false, exception_flag: false,
          lineage: [{ value, source: `${source} (${documentType})`, source_url: file.sourceUrl, document_id: file.filename, timestamp, confidence_score: 0.85 }],
        }]));
      persons.push({
        source: `${source} (${documentType})`,
        role: group.role,
        personIndex: index,
        fullName: person.full_name ?? null,
        ownershipPct: Number.isFinite(Number(person.ownership_pct)) ? Number(person.ownership_pct) : null,
        nationality: person.nationality ?? null,
        attributes: wrappedAttributes,
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
