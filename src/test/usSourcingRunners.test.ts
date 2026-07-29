import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../agents/runners/api/sourcingArtifacts.js', () => ({
  captureSourceScreenshot: vi.fn(async (_url: string, options: any) => ({
    filename: options.filename, title: options.title, mimeType: 'image/png', content: Buffer.from('screenshot'), sourceUrl: _url,
  })),
  captureBrowserSessionScreenshot: vi.fn(async (_sessionId: string, options: any) => ({
    filename: options.filename, title: options.title, mimeType: 'image/png', content: Buffer.from('screenshot'), sourceUrl: options.sourceUrl,
  })),
  scrapeBrowserEvidence: vi.fn(async (_url: string, options: any) => ({
    json: { found: true, entity_name: 'EXAMPLE HOLDINGS INC', listed_exchange: 'NYSE', corporate_officers: [] },
    screenshot: { filename: options.filename, title: options.title, mimeType: 'image/png', content: Buffer.from('screenshot'), sourceUrl: _url },
  })),
  downloadSourceDocument: vi.fn(async (url: string, options: any) => ({
    filename: options.filename, title: options.title, mimeType: 'application/pdf', content: Buffer.from('document'), sourceUrl: url,
  })),
  digitizeKycDocument: vi.fn(async () => ({ attributes: [], persons: [] })),
  mergeStructuredAttributes: (structured: any[], digitized: any[]) => {
    const names = new Set(structured.map(item => item.attributeName));
    return [...structured, ...digitized.filter(item => !names.has(item.attributeName))];
  },
}));
import { IAPDRunner } from '../../agents/runners/api/IAPDRunner.js';
import { SECEDGARRunner } from '../../agents/runners/api/SECEDGARRunner.js';
import { NYSERunner } from '../../agents/runners/api/NYSERunner.js';
import { DelawareRunner, NFARunner, PuertoRicoRunner } from '../../agents/runners/api/USRegistryResearchRunners.js';
import { AttributePublisher } from '../../agents/publishers/AttributePublisher.js';
import { captureSourceScreenshot, scrapeBrowserEvidence } from '../../agents/runners/api/sourcingArtifacts.js';

const jsonResponse = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(AbortSignal, 'timeout', { configurable: true, value: vi.fn(() => undefined) });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SEC_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;
});

describe('US sourcing provider contracts', () => {
  it('prevents sourcing publishers from persisting ID/V decisions', async () => {
    let inserted: any[] = [];
    const sb = { from: () => ({ insert: async (rows: any[]) => { inserted = rows; return { error: null }; } }) };
    const attributes = [{ attributeName: 'entity_name', attributeGroup: 'core', displayValue: 'EXAMPLE LP', source: 'Official registry', confidence: 100, idFlag: true, verificationFlag: true }];
    await new AttributePublisher(sb as any).publish('CASE_1', 'run-1', attributes as any);
    expect(inserted[0]).toMatchObject({ id_flag: false, id_source: null, id_reasoning: null, verification_flag: false, verification_source: null, verification_reasoning: null });
  });

  it('allows an explicitly authorized DD publisher to persist ID/V decisions', async () => {
    let inserted: any[] = [];
    const sb = { from: () => ({ insert: async (rows: any[]) => { inserted = rows; return { error: null }; } }) };
    const attributes = [{ attributeName: 'entity_name', attributeGroup: 'core', displayValue: 'EXAMPLE LP', source: 'DD policy', confidence: 95, idFlag: true, verificationFlag: true }];
    await new AttributePublisher(sb as any).publish('CASE_1', 'run-2', attributes as any, { allowIdv: true });
    expect(inserted[0]).toMatchObject({ id_flag: true, id_source: 'DD policy', verification_flag: true, verification_source: ['DD policy'] });
  });

  it('uses the current Form ADV query and filings response shape', async () => {
    process.env.SEC_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ filings: [{
      Info: { FirmCrdNb: 123, SECNb: '801-123', LegalNm: 'EXAMPLE ADVISERS LLC', BusNm: 'EXAMPLE ADVISERS LLC', MainAddr: { Strt1: '1 MAIN ST', City: 'NEW YORK', State: 'NY', PstlCd: '10001' } },
      FormInfo: { Part1A: { Item1: { WebAddrs: { WebAddr: 'https://example.test' } }, Item5F: { Q5F2C: 1000000 } } },
    }] }))
      .mockResolvedValueOnce(jsonResponse({ hits: { hits: [{ _source: { iacontent: JSON.stringify({ registrationStatus: [{ status: 'ACTIVE' }] }) } }] } }))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const output = await new IAPDRunner({}).execute({ kycRef: 'CASE_1', entityName: 'Example Advisers LLC' });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.query).toContain('Info.LegalNm');
    expect(output.metadata.outcome).not.toBe('no_data');
    expect(output.attributes?.find((attr) => attr.attributeName === 'registration_number')?.displayValue).toBe('123');
  });

  it('resolves EDGAR CIK through the official company ticker dataset', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ 0: { cik_str: 1234, ticker: 'EX', title: 'EXAMPLE HOLDINGS INC' } }))
      .mockResolvedValueOnce(jsonResponse({ name: 'EXAMPLE HOLDINGS INC', entityType: 'operating', tickers: ['EX'], exchanges: ['NYSE'] }));
    vi.stubGlobal('fetch', fetchMock);

    const output = await new SECEDGARRunner({}).execute({ kycRef: 'CASE_1', entityName: 'Example Holdings, Inc.' });
    expect(fetchMock.mock.calls[0][0]).toContain('company_tickers.json');
    expect(fetchMock.mock.calls[1][0]).toContain('CIK0000001234.json');
    expect(output.attributes?.find((attr) => attr.attributeName === 'registration_number')?.displayValue).toBe('1234');
  });

  it('does not substring-match an unrelated short EDGAR company name', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      0: { cik_str: 1018963, ticker: 'ATI', title: 'ATI INC' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const output = await new SECEDGARRunner({}).execute({
      kycRef: 'CASE_1',
      entityName: 'FIRST ADVISORS NATIONAL, LLC',
    });

    expect(output.metadata.outcome).toBe('no_data');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the official NYSE browser source and retains its screenshot', async () => {
    const output = await new NYSERunner({}).execute({ kycRef: 'CASE_1', entityName: 'Example Holdings Inc.' });
    expect(output.attributes?.find((attr) => attr.attributeName === 'listing_status')?.displayValue).toBe('Listed');
    expect(output.attributes?.find((attr) => attr.attributeName === 'listed_exchange')?.displayValue).toBe('NYSE');
    expect(output.files).toHaveLength(1);
  });

  it('reuses the NYSE search screenshot for a confirmed no-match', async () => {
    vi.mocked(scrapeBrowserEvidence).mockResolvedValueOnce({
      json: { found: false },
      data: { found: false },
      screenshot: { filename: 'nyse.png', mimeType: 'image/png', content: Buffer.from('screenshot') },
    } as any);
    const output = await new NYSERunner({}).execute({ kycRef: 'CASE_1', entityName: 'Missing Holdings LLC' });
    expect(output.metadata.outcome).toBe('no_data');
    expect(output.files).toHaveLength(1);
    expect(captureSourceScreenshot).not.toHaveBeenCalled();
  });

  it('queries NFA BASIC directly and distinguishes a confirmed no-match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      result: { success: true, result: { result: { rows: [] } } }, error: null,
    })));
    const output = await new NFARunner({}).execute({ kycRef: 'CASE_1', entityName: 'Example LP' });
    expect(output.metadata.outcome).toBe('no_data');
  });

  it('maps an official Puerto Rico registry result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      success: true, code: 1,
      response: { records: [{ corpName: 'EXAMPLE LP', registrationIndex: '123-456', statusEn: 'ACTIVE', classEn: 'Limited Partnership' }] },
    })));
    const output = await new PuertoRicoRunner({}).execute({ kycRef: 'CASE_1', entityName: 'Example LP' });
    expect(output.metadata.outcome).toBe('data_found');
    expect(output.attributes?.find((attr) => attr.attributeName === 'registration_number')?.displayValue).toBe('123-456');
  });

  it('maps an exact Delaware result returned through a disposable Firecrawl browser', async () => {
    process.env.FIRECRAWL_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, id: 'session-1' }))
      .mockResolvedValueOnce(jsonResponse({
        success: true, exitCode: 0, killed: false, error: null,
        stdout: '__DELAWARE_RESULTS__\nFILE NUMBER\nENTITY NAME\n- cell "5147304" [ref=e43]\n  - StaticText "5147304"\n- cell "EXAMPLE LP" [ref=e44]',
      }))
      .mockResolvedValueOnce(jsonResponse({ success: true })));
    const output = await new DelawareRunner({}).execute({ kycRef: 'CASE_1', entityName: 'Example LP' });
    expect(output.metadata.outcome).toBe('data_found');
    expect(output.attributes?.find((attr) => attr.attributeName === 'registration_number')?.displayValue).toBe('5147304');
  });

  it('treats a valid empty Delaware result as no data', async () => {
    process.env.FIRECRAWL_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, id: 'session-1' }))
      .mockResolvedValueOnce(jsonResponse({ success: true, exitCode: 0, killed: false, error: null, stdout: '__DELAWARE_RESULTS__\nFILE NUMBER\nENTITY NAME' }))
      .mockResolvedValueOnce(jsonResponse({ success: true })));
    const output = await new DelawareRunner({}).execute({ kycRef: 'CASE_1', entityName: 'Missing LP' });
    expect(output.metadata.outcome).toBe('no_data');
  });
});
