import { describe, expect, it, vi } from 'vitest';
import { FilePublisher } from '../../agents/publishers/FilePublisher.js';
import { DOCUMENT_TYPES } from '../../agents/runners/api/sourcingArtifacts.js';

describe('post-sourcing document processing contract', () => {
  it('uses the Forge classifier vocabulary', () => {
    expect(DOCUMENT_TYPES).toContain('SEC Form ADV');
    expect(DOCUMENT_TYPES).toContain('10K/Annual Report');
    expect(DOCUMENT_TYPES).toContain('Certificate of Incorporation');
    expect(DOCUMENT_TYPES).toContain('Prospectus');
    expect(DOCUMENT_TYPES).toContain('Other');
    expect(DOCUMENT_TYPES).toContain('Unknown');
  });

  it('does not upload byte-identical evidence already stored for the entity', async () => {
    const upload = vi.fn();
    const query: any = {
      select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: { id: 'existing-file' }, error: null }),
    };
    const sb: any = {
      from: () => query,
      storage: { from: () => ({ upload }) },
    };
    const result = await new FilePublisher(sb).publish('CASE_1', 'run-1', [{
      filename: 'form-adv.pdf', mimeType: 'application/pdf', fileCategory: 'document',
      title: 'Form ADV', content: Buffer.from('same bytes'),
    }]);
    expect(result).toEqual({ stored: 0, errors: [] });
    expect(upload).not.toHaveBeenCalled();
  });
});
