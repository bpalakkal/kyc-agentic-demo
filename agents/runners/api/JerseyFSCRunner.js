/**
 * Jersey FSC Runner — Claude SDK tool-use implementation.
 *
 * Uses an agentic loop with a single `fetch_url` tool so Claude can browse
 * the JFSC public registry, extract entity data, and return structured JSON.
 * Confidence is set to 85 (lower than pure-API runners) because the data
 * extraction is LLM-assisted.
 */

import { ApiRunner } from '../../base/ApiRunner.js';
import { createBedrockClaudeClient } from '../../models/bedrock.js';
import { captureSourceScreenshot } from './sourcingArtifacts.js';

const SOURCE     = 'Jersey FSC';
const CONFIDENCE = 85;
const MAX_ITER   = 12;
const FETCH_TIMEOUT_MS = 15_000;

const TOOLS = [
  {
    name: 'fetch_url',
    description: 'Make an HTTP GET request to a URL and return the response body as text. Use this to search the JFSC registry and retrieve entity details.',
    input_schema: {
      type: 'object',
      properties: {
        url:         { type: 'string', description: 'Absolute URL to fetch' },
        description: { type: 'string', description: 'What you are looking for here' },
      },
      required: ['url'],
    },
  },
];

const SYSTEM_PROMPT = `You are a KYC data extraction agent. Your task is to find an entity in the Jersey Financial Services Commission (JFSC) public registry at https://www.jerseyfsc.org/registry/ and extract its registration details.

Use the fetch_url tool to:
1. Search the JFSC registry for the entity name provided
2. Follow links to the entity detail page if available
3. Extract the registration data

When you have gathered enough information (or the entity is not found), respond with a JSON object ONLY — no surrounding text — in this exact shape:
{
  "found": true | false,
  "entity_name": string | null,
  "registration_number": string | null,
  "entity_status": string | null,
  "date_of_incorporation": string | null,
  "legal_registered_address": string | null,
  "country_of_incorporation": "Jersey",
  "legal_structure": string | null,
  "regulator": string | null,
  "source_url": string | null
}

If the entity is not found, set "found": false and leave all other fields null.`;

export class JerseyFSCRunner extends ApiRunner {
  get slug()       { return 'jersey-fsc'; }
  get outputType() { return 'attributes'; }

  async execute(ctx) {
    const { kycRef, entityName } = ctx;
    const startedAt = Date.now();

    this.step(`Searching JFSC registry for "${entityName}"…`);

    const client = createBedrockClaudeClient(this.modelProfile?.key ?? 'bedrock-claude-haiku');

    const messages = [
      { role: 'user', content: `Find the JFSC registration record for the entity: "${entityName}"` },
    ];

    let entityData = null;
    let iterations = 0;

    while (iterations < MAX_ITER) {
      iterations++;

      const response = await client.messages.create({
        model:      client.profile.modelId,
        max_tokens: 4096,
        system:     SYSTEM_PROMPT,
        tools:      TOOLS,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        for (const block of response.content) {
          if (block.type !== 'text') continue;
          const match = block.text.match(/\{[\s\S]*\}/);
          if (match) {
            try { entityData = JSON.parse(match[0]); } catch { /* ignore */ }
          }
        }
        break;
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults = [];
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;
          let content = '';
          try {
            const resp = await fetch(block.input.url, {
              headers: { 'User-Agent': 'KYC-Sentinel/1.0 Compliance-Research' },
              signal:  AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
            content = await resp.text();
            if (content.length > 20_000) content = content.slice(0, 20_000) + '\n...[truncated]';
            this.step(`  Fetched ${block.input.url} (HTTP ${resp.status})`);
          } catch (err) {
            content = `Error fetching URL: ${err.message}`;
            this.step(`  Fetch failed: ${err.message}`);
          }
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content });
        }
        messages.push({ role: 'user', content: toolResults });
      }
    }

    if (!entityData?.found) {
      this.step('No JFSC entity record found');
      const searchUrl = `https://www.jerseyfsc.org/registry/registry-entities/?search=${encodeURIComponent(entityName)}`;
      const screenshot = await captureSourceScreenshot(searchUrl, { filenamePrefix: 'jersey-fsc-no-match', entityName, sourceName: 'Jersey Financial Services Commission', outcome: 'no_data', outcomeReason: 'No matching JFSC entity record' });
      return this._result(kycRef, [], startedAt, [searchUrl], [screenshot]);
    }

    this.step(`Found: ${entityData.entity_name ?? entityName}`);
    const attributes = this._mapToAttributes(entityData);
    const evidenceUrl = entityData.source_url ?? `https://www.jerseyfsc.org/registry/registry-entities/?search=${encodeURIComponent(entityName)}`;
    const screenshot = await captureSourceScreenshot(evidenceUrl, { filenamePrefix: 'jersey-fsc', entityName, sourceName: 'Jersey Financial Services Commission', outcome: 'data_found', details: entityData });
    this.step(`Mapped ${attributes.length} attribute(s)`);

    return this._result(kycRef, attributes, startedAt, [evidenceUrl], [screenshot]);
  }

  _result(kycRef, attributes, startedAt, sources = ['Jersey FSC Registry'], files = []) {
    return {
      agentSlug:  this.slug,
      kycRef,
      outputType: 'attributes',
      attributes,
      files,
      metadata: {
        outcome:         attributes.length ? 'data_found' : 'no_data',
        outcomeReason:   attributes.length ? null : 'No matching Jersey FSC entity record',
        completedAt:      new Date().toISOString(),
        durationMs:       Date.now() - startedAt,
        sourcesConsulted: sources,
      },
    };
  }

  _mapToAttributes(d) {
    const attrs     = [];
    const fetchedAt = new Date().toISOString();
    const sourceUrl = d.source_url ?? '';

    const push = (attributeName, displayValue, extra = {}) => {
      if (displayValue === null || displayValue === undefined) return;
      const val = Array.isArray(displayValue)
        ? displayValue.filter(Boolean).join('; ')
        : String(displayValue).trim();
      if (!val || val.toLowerCase() === 'n/a') return;
      attrs.push({
        attributeName,
        attributeGroup:   'core',
        displayValue:     val,
        source:           SOURCE,
        confidence:       CONFIDENCE,
        idFlag:           extra.idFlag           ?? false,
        verificationFlag: extra.verificationFlag ?? false,
        exceptionFlag:    false,
        lineage: [{
          value:            val,
          source:           SOURCE,
          source_url:       sourceUrl,
          timestamp:        fetchedAt,
          confidence_score: CONFIDENCE / 100,
        }],
      });
    };

    push('entity_name',              d.entity_name);
    push('uk_registration_number',   d.registration_number, { idFlag: true, verificationFlag: true });
    push('entity_status',            d.entity_status);
    push('date_of_incorporation',    d.date_of_incorporation);
    push('legal_registered_address', d.legal_registered_address);
    push('country_of_incorporation', d.country_of_incorporation ?? 'Jersey');
    push('legal_structure',          d.legal_structure);
    push('entity_source_url',        d.source_url);
    push('regulator',                d.regulator, { verificationFlag: true });

    return attrs;
  }
}
