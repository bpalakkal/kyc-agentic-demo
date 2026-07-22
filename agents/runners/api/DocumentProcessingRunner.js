import { createHash } from 'node:crypto';
import { ApiRunner } from '../../base/ApiRunner.js';
import schemaMeta from '../../../schema/schema-meta.js';
import { classifyKycDocument, digitizeKycDocument } from './sourcingArtifacts.js';

const SCALAR_FIELDS = Object.entries(schemaMeta.attributes)
  .filter(([name, meta]) => meta.kind === 'scalar' && !meta.party && !['entity_id', 'case_id'].includes(name))
  .map(([name]) => name);
const PARTY_ROLES = Object.entries(schemaMeta.attributes)
  .filter(([, meta]) => meta.kind === 'array' && meta.party && meta.party !== 'documents')
  .map(([, meta]) => meta.party);

export class DocumentProcessingRunner extends ApiRunner {
  get slug() { return 'document-processing-flow'; }
  get outputType() { return 'both'; }

  async execute({ kycRef }) {
    const startedAt = Date.now();
    const { data: candidates, error } = await this.sb.from('case_files')
      .select('id, filename, title, mime_type, storage_path, source_url, content_sha256, processing_status')
      .eq('kyc_ref', kycRef).eq('file_category', 'document')
      .in('processing_status', ['pending', 'failed']).order('created_at', { ascending: true });
    if (error) throw error;
    if (!candidates?.length) {
      this.step('No new documents require classification or digitization');
      return this._output(kycRef, startedAt, [], [], [], 'no_data');
    }

    this.step(`Found ${candidates.length} new document(s)`);
    const existingAttributeNames = await this._existingAttributeNames(kycRef);
    const attributes = [];
    const persons = [];
    const processedIds = [];
    const failures = [];
    for (const record of candidates) {
      const claimed = await this._claim(record.id);
      if (!claimed) continue;
      try {
        const file = await this._download(record);
        const hash = createHash('sha256').update(file.content).digest('hex');
        const duplicate = await this._findDuplicate(kycRef, record.id, hash);
        if (duplicate) {
          await this.sb.from('case_files').update({ processing_status: 'duplicate', content_sha256: null, processing_error: `Duplicate of ${duplicate.id}` }).eq('id', record.id);
          this.step(`Skipped duplicate ${record.filename}`);
          continue;
        }
        const classification = await classifyKycDocument(file);
        await this.sb.from('case_files').update({
          content_sha256: hash, document_type: classification.documentType,
          classification_reason: classification.reason, classified_at: new Date().toISOString(), processing_error: null,
        }).eq('id', record.id);
        const digitized = await digitizeKycDocument(file, {
          documentType: classification.documentType,
          source: `Document: ${record.title || record.filename}`,
          scalarFields: SCALAR_FIELDS, partyRoles: PARTY_ROLES,
        });
        attributes.push(...digitized.attributes);
        persons.push(...digitized.persons);
        processedIds.push(record.id);
        this.step(`${record.filename}: ${classification.documentType}; ${digitized.attributes.length} field(s), ${digitized.persons.length} party record(s)`);
      } catch (processingError) {
        failures.push(`${record.filename}: ${processingError.message}`);
        await this.sb.from('case_files').update({ processing_status: 'failed', processing_error: processingError.message }).eq('id', record.id);
      }
    }
    this._processedFileIds = processedIds;
    if (failures.length && !processedIds.length) throw new Error(`Document processing failed: ${failures.join(' | ')}`);
    const seen = new Set(existingAttributeNames);
    const gapFillingAttributes = attributes.filter(attribute => {
      if (seen.has(attribute.attributeName)) return false;
      seen.add(attribute.attributeName);
      return true;
    });
    return this._output(kycRef, startedAt, gapFillingAttributes, persons, processedIds, processedIds.length ? 'data_found' : 'no_data', failures);
  }

  async _publish(kycRef, agentRunId, output, initiatedBy) {
    const stats = await super._publish(kycRef, agentRunId, output, initiatedBy);
    if (this._processedFileIds?.length) {
      const { error } = await this.sb.from('case_files').update({
        processing_status: 'complete', digitized_at: new Date().toISOString(),
        processing_agent_run_id: agentRunId, processing_error: null,
      }).in('id', this._processedFileIds);
      if (error) throw error;
    }
    return stats;
  }

  async _claim(id) {
    const { data, error } = await this.sb.from('case_files').update({ processing_status: 'processing', processing_error: null })
      .eq('id', id).in('processing_status', ['pending', 'failed']).select('id').maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async _download(record) {
    const { data, error } = await this.sb.storage.from('kyc-files').download(record.storage_path);
    if (error) throw error;
    return { filename: record.filename, title: record.title, mimeType: record.mime_type, sourceUrl: record.source_url, content: Buffer.from(await data.arrayBuffer()) };
  }

  async _findDuplicate(kycRef, id, hash) {
    const { data, error } = await this.sb.from('case_files').select('id').eq('kyc_ref', kycRef)
      .eq('file_category', 'document').eq('content_sha256', hash).neq('id', id).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  }

  async _existingAttributeNames(kycRef) {
    const { data: runs, error: runError } = await this.sb.from('agent_runs').select('id')
      .eq('kyc_ref', kycRef).eq('status', 'complete').neq('agent_slug', this.slug);
    if (runError) throw runError;
    if (!runs?.length) return new Set();
    const { data, error } = await this.sb.from('entity_attributes').select('attribute_name')
      .eq('kyc_ref', kycRef).in('agent_run_id', runs.map(run => run.id));
    if (error) throw error;
    return new Set((data ?? []).map(row => row.attribute_name));
  }

  _output(kycRef, startedAt, attributes, persons, processedIds, outcome, failures = []) {
    return { agentSlug: this.slug, kycRef, outputType: 'both', attributes, persons, personSource: 'Document digitization', files: [], metadata: { outcome, outcomeReason: failures.length ? failures.join(' | ') : null, completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sourcesConsulted: processedIds.map(id => `case_files:${id}`) } };
  }
}
