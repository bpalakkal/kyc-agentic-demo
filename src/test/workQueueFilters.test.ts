import { describe, expect, it } from 'vitest';
import { filterWorkQueueRows, type WorkQueueFilters } from '../lib/workQueueFilters';

const rows: any[] = [
  { id: 'KYC-1', name: 'Alpha Advisers LLC', kyc: 'KYC-1', drg: 'US Advisors', due: 'Jul 1, 2026', confidence: 'High', customerType: 'RIA', jurisdiction: 'United States', priority: 'High', risk: 'Elevated', exc: 2, status: 'In Progress', action: 'Periodic Refresh' },
  { id: 'KYC-2', name: 'Beta Capital LLP', kyc: 'KYC-2', drg: 'UK Advisors', due: 'Aug 1, 2026', confidence: 'High', customerType: 'RIA', jurisdiction: 'United Kingdom', priority: 'Low', risk: 'Minimal', exc: 0, status: 'Complete', action: 'Periodic Refresh' },
];
const empty: WorkQueueFilters = { priority: 'all', risk: 'all', status: 'all', jurisdiction: 'all' };

describe('work queue filtering', () => {
  it('searches entity names, references, groups, and row metadata case-insensitively', () => {
    expect(filterWorkQueueRows(rows, 'alpha', empty).map(row => row.id)).toEqual(['KYC-1']);
    expect(filterWorkQueueRows(rows, 'kyc-2', empty).map(row => row.id)).toEqual(['KYC-2']);
    expect(filterWorkQueueRows(rows, 'uk advisors', empty).map(row => row.id)).toEqual(['KYC-2']);
  });

  it('combines priority, risk, status, and jurisdiction filters', () => {
    expect(filterWorkQueueRows(rows, '', { priority: 'High', risk: 'Elevated', status: 'In Progress', jurisdiction: 'United States' }).map(row => row.id)).toEqual(['KYC-1']);
    expect(filterWorkQueueRows(rows, '', { ...empty, priority: 'High', jurisdiction: 'United Kingdom' })).toEqual([]);
  });
});
