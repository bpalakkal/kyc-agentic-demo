import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IAPDRunner } from '../../agents/runners/api/IAPDRunner.js';
import { SECEDGARRunner } from '../../agents/runners/api/SECEDGARRunner.js';
import { NYSERunner } from '../../agents/runners/api/NYSERunner.js';

const jsonResponse = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

beforeEach(() => {
  Object.defineProperty(AbortSignal, 'timeout', { configurable: true, value: vi.fn(() => undefined) });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SEC_API_KEY;
});

describe('US sourcing provider contracts', () => {
  it('uses the current Form ADV query and filings response shape', async () => {
    process.env.SEC_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ filings: [{
      Info: { FirmCrdNb: 123, SECNb: '801-123', BusNm: 'EXAMPLE ADVISERS LLC' },
      MainAddr: { Strt1: '1 MAIN ST', City: 'NEW YORK', State: 'NY', PstlCd: '10001' },
      Rgstn: [{ FirmType: 'Registered', St: 'ACTIVE' }],
      FormInfo: { Part1A: { Item1: { WebAddrs: { WebAddr: 'https://example.test' } }, Item5F: { Q5F2C: 1000000 } } },
    }] }));
    vi.stubGlobal('fetch', fetchMock);

    const output = await new IAPDRunner({}).execute({ kycRef: 'CASE_1', entityName: 'Example Advisers LLC' });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.query).toContain('Info.BusNm');
    expect(output.metadata.outcome).not.toBe('no_data');
    expect(output.attributes?.find((attr) => attr.attributeName === 'registration_number')?.displayValue).toBe('801-123');
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

  it('uses the SEC exchange association dataset instead of the NYSE website API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      fields: ['cik', 'name', 'ticker', 'exchange'],
      data: [[1234, 'EXAMPLE HOLDINGS INC', 'EX', 'NYSE']],
    })));
    const output = await new NYSERunner({}).execute({ kycRef: 'CASE_1', entityName: 'Example Holdings Inc.' });
    expect(output.attributes?.find((attr) => attr.attributeName === 'listing_status')?.displayValue).toBe('Listed');
    expect(output.attributes?.find((attr) => attr.attributeName === 'listed_exchange')?.displayValue).toBe('NYSE');
  });
});
