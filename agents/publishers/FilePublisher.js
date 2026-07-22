/**
 * Uploads file content produced by direct REST or Claude runners to private
 * Supabase Storage and records its metadata in case_files.
 *
 * A failed file is reported without aborting the rest of the batch.
 */

import { createHash } from 'node:crypto';

const BUCKET = 'kyc-files';

export class FilePublisher {
  /** @param {import('@supabase/supabase-js').SupabaseClient} sb */
  constructor(sb) {
    this.sb = sb;
  }

  /**
   * @param {string} kycRef
   * @param {string} agentRunId
   * @param {import('../types.js').FileOutput[]} files
   * @param {string=} uploadedBy
   * @returns {Promise<{stored: number, errors: string[]}>}
   */
  async publish(kycRef, agentRunId, files, uploadedBy) {
    if (!files?.length) return { stored: 0, errors: [] };

    let stored = 0;
    const errors = [];

    for (const file of files) {
      try {
        if (!file.content) throw new Error(`FileOutput for "${file.filename}" has no content`);
        const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);
        const contentSha256 = createHash('sha256').update(content).digest('hex');
        const { data: existing, error: lookupErr } = await this.sb.from('case_files')
          .select('id').eq('kyc_ref', kycRef).eq('file_category', file.fileCategory)
          .eq('content_sha256', contentSha256).maybeSingle();
        if (lookupErr) throw lookupErr;
        if (existing) continue;
        const folder = file.fileCategory === 'document' ? 'documents' : 'screenshots';
        const safeName = file.filename.replace(/[^A-Za-z0-9._\-]/g, '_');
        const storagePath = `${kycRef}/${folder}/${Date.now()}_${safeName}`;

        const { error: uploadErr } = await this.sb.storage
          .from(BUCKET)
          .upload(storagePath, content, { contentType: file.mimeType, upsert: false });
        if (uploadErr) throw uploadErr;

        const { error: dbErr } = await this.sb.from('case_files').insert({
          kyc_ref: kycRef,
          agent_run_id: agentRunId,
          file_category: file.fileCategory,
          mime_type: file.mimeType,
          filename: file.filename,
          title: file.title ?? file.filename,
          caption: file.caption ?? null,
          storage_path: storagePath,
          source_url: file.sourceUrl ?? null,
          uploaded_by: uploadedBy ?? null,
          content_sha256: contentSha256,
          processing_status: file.fileCategory === 'document' ? 'pending' : 'not_applicable',
        });
        if (dbErr) throw dbErr;

        stored++;
      } catch (err) {
        const msg = `[FilePublisher] ${file.filename}: ${err.message ?? err}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    return { stored, errors };
  }
}
