/**
 * FilePublisher — uploads agent output files to Supabase Storage and records
 * their metadata in the case_files table.
 *
 * Handles two file sources:
 *   1. API runners — provide file.content (Buffer) directly
 *   2. Autonomous agents — provide file.artifactPath, which is downloaded from
 *      the AWS ELB before upload
 *
 * Per-file errors are logged but don't abort the batch — a single bad file
 * shouldn't fail the whole run.  Returns the count of successfully stored files.
 *
 * Storage layout:
 *   kyc-files/{kyc_ref}/documents/{timestamp}_{filename}
 *   kyc-files/{kyc_ref}/screenshots/{timestamp}_{filename}
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} sb  Service-key client
 */

const BUCKET = 'kyc-files';

const AWS_AGENT_BASE =
  process.env.AWS_AGENT_BASE ??
  'http://gs-forge-agentic-runtime-lb-1873180191.us-east-1.elb.amazonaws.com';

export class FilePublisher {
  /** @param {import('@supabase/supabase-js').SupabaseClient} sb */
  constructor(sb) {
    this.sb = sb;
  }

  /**
   * Upload files to storage and insert case_files rows.
   *
   * @param {string}  kycRef
   * @param {string}  agentRunId   — agent_runs.id (must already exist)
   * @param {import('../types.js').FileOutput[]} files
   * @param {string=} uploadedBy   — auth.users.id; omit for agent uploads
   * @returns {Promise<{stored: number, errors: string[]}>}
   */
  async publish(kycRef, agentRunId, files, uploadedBy) {
    if (!files?.length) return { stored: 0, errors: [] };

    let stored = 0;
    const errors = [];

    for (const file of files) {
      try {
        const content = await this._resolveContent(file);
        const folder  = file.fileCategory === 'document' ? 'documents' : 'screenshots';
        const safeName = file.filename.replace(/[^A-Za-z0-9._\-]/g, '_');
        const storagePath = `${kycRef}/${folder}/${Date.now()}_${safeName}`;

        // Upload to Supabase Storage.
        const { error: uploadErr } = await this.sb.storage
          .from(BUCKET)
          .upload(storagePath, content, {
            contentType: file.mimeType,
            upsert: false,
          });
        if (uploadErr) throw uploadErr;

        // Record metadata in case_files.
        const { error: dbErr } = await this.sb.from('case_files').insert({
          kyc_ref:       kycRef,
          agent_run_id:  agentRunId,
          file_category: file.fileCategory,
          mime_type:     file.mimeType,
          filename:      file.filename,
          title:         file.title ?? file.filename,
          caption:       file.caption ?? null,
          storage_path:  storagePath,
          source_url:    file.sourceUrl ?? null,
          uploaded_by:   uploadedBy ?? null,
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

  /**
   * Resolves a FileOutput to a Buffer, either from inline content or by
   * downloading the artifact from the AWS ELB.
   *
   * @param {import('../types.js').FileOutput} file
   * @returns {Promise<Buffer>}
   */
  async _resolveContent(file) {
    if (file.content) {
      return Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);
    }

    if (file.artifactPath) {
      // C4: The path must look like /artifacts/<safe-segments> — same rule as the
      // server's /api/artifact-download route. Publishers run server-side, so we
      // call the ELB directly rather than looping through our own HTTP endpoint.
      if (!/^\/artifacts\/[A-Za-z0-9_\-\/\.]+$/.test(file.artifactPath)) {
        throw new Error(`Unsafe artifact path rejected: ${file.artifactPath}`);
      }
      const url = `${AWS_AGENT_BASE}${file.artifactPath}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        throw new Error(`Artifact download failed (HTTP ${res.status}): ${file.artifactPath}`);
      }
      return Buffer.from(await res.arrayBuffer());
    }

    throw new Error(
      `FileOutput for "${file.filename}" has neither content nor artifactPath`
    );
  }
}
