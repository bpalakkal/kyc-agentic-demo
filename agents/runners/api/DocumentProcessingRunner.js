import { createHash } from 'node:crypto';
import { ApiRunner } from '../../base/ApiRunner.js';
import { classifyKycDocument } from './sourcingArtifacts.js';
import { DocumentDigitizationRunner } from './DocumentDigitizationRunner.js';
import { digitizerSlugForType } from './documentDigitizers.js';

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'kyc-files';

export class DocumentProcessingRunner extends ApiRunner {
  get slug() { return 'document-processing-flow'; }
  get outputType() { return 'both'; }

  async execute({ kycRef, entityName, initiatedBy, currentRunId }) {
    const startedAt = Date.now();
    const { data: candidates, error } = await this.sb.from('case_files')
      .select('id, filename, title, mime_type, storage_path, source_url, content_sha256, processing_status')
      .eq('kyc_ref', kycRef).eq('file_category', 'document')
      .in('processing_status', ['pending', 'failed']).order('created_at', { ascending: true });
    if (error) throw error;
    if (!candidates?.length) {
      this.step('No new documents require classification or digitization');
      return this._output(kycRef, startedAt, [], 'no_data');
    }

    this.step(`Found ${candidates.length} new document(s)`);
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
        const classification = await classifyKycDocument(file, { modelProfileKey: this.modelProfile?.key });
        await this.sb.from('case_files').update({
          content_sha256: hash, document_type: classification.documentType,
          classification_reason: classification.reason, classified_at: new Date().toISOString(), processing_error: null,
        }).eq('id', record.id);
        const digitizer = await this._resolveDigitizer(classification.documentType);
        const child = new DocumentDigitizationRunner(this.sb, {
          ...digitizer, file: { ...file, id: record.id }, modelProfile: digitizer.modelProfile,
        });
        child._onStep = message => this.step(`${digitizer.slug}: ${message}`);
        const childResult = await child.run({
          kycRef, entityName, initiatedBy, parentRunId: currentRunId, runPhase: 'main',
        });
        await this.sb.from('case_files').update({
          processing_status: 'complete', digitized_at: new Date().toISOString(),
          processing_agent_run_id: childResult.runId, processing_error: null,
        }).eq('id', record.id);
        processedIds.push(record.id);
        this.step(`${record.filename}: classified as ${classification.documentType} and processed by ${digitizer.slug}`);
      } catch (processingError) {
        failures.push(`${record.filename}: ${processingError.message}`);
        await this.sb.from('case_files').update({ processing_status: 'failed', processing_error: processingError.message }).eq('id', record.id);
      }
    }
    if (failures.length && !processedIds.length) throw new Error(`Document processing failed: ${failures.join(' | ')}`);
    return this._output(kycRef, startedAt, processedIds, processedIds.length ? 'data_found' : 'no_data', failures);
  }

  async _claim(id) {
    const { data, error } = await this.sb.from('case_files').update({ processing_status: 'processing', processing_error: null })
      .eq('id', id).in('processing_status', ['pending', 'failed']).select('id').maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async _download(record) {
    const { data, error } = await this.sb.storage.from(STORAGE_BUCKET).download(record.storage_path);
    if (error) throw error;
    return { filename: record.filename, title: record.title, mimeType: record.mime_type, sourceUrl: record.source_url, content: Buffer.from(await data.arrayBuffer()) };
  }

  async _findDuplicate(kycRef, id, hash) {
    const { data, error } = await this.sb.from('case_files').select('id').eq('kyc_ref', kycRef)
      .eq('file_category', 'document').eq('content_sha256', hash).neq('id', id).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  }

  async _resolveDigitizer(documentType) {
    const preferredSlug = digitizerSlugForType(documentType);
    const { data, error } = await this.sb.from('agent_registry')
      .select('slug,document_type,model_profile').eq('slug', preferredSlug).eq('agent_kind', 'document_digitizer')
      .eq('enabled', true).eq('user_triggerable', false).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`No enabled dependency-only digitizer is registered for ${documentType}`);
    const { resolveModelProfile } = await import('../../models/claude.js');
    return {
      slug: data.slug,
      documentType,
      modelProfile: data.model_profile ? resolveModelProfile(data.model_profile) : this.modelProfile,
    };
  }

  _output(kycRef, startedAt, processedIds, outcome, failures = []) {
    return { agentSlug: this.slug, kycRef, outputType: 'both', attributes: [], persons: [], files: [], metadata: { outcome, outcomeReason: failures.length ? failures.join(' | ') : null, completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sourcesConsulted: processedIds.map(id => `case_files:${id}`) } };
  }
}
