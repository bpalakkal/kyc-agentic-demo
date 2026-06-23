/**
 * Agent registry — single source of truth mapping agent slugs to metadata.
 *
 * Runners are wired up here as they are implemented.
 * The slug must match:
 *   - AgentSystem.tsx AGENTS[].id
 *   - agent_runs.agent_slug in the database
 *   - The AWS ELB slug (for autonomous runners)
 */

import type { AgentRegistryEntry } from './types.js';

export const AGENT_REGISTRY: AgentRegistryEntry[] = [
  // ── API runners (direct REST pulls, synchronous) ──────────────────────────
  {
    slug: 'fca',
    displayName: 'FCA Register',
    description: 'UK Financial Conduct Authority register',
    runnerType: 'api',
    outputType: 'attributes',
  },
  {
    slug: 'uk-sourcing-flow',
    displayName: 'UK Data Sourcing',
    description: 'Orchestrates FCA, Companies House, and Jersey FSC — merges all sources with multi-lineage tracking',
    runnerType: 'api',
    outputType: 'attributes',
  },

  // ── Autonomous runners (AWS ELB agents, async + polling) ──────────────────
  {
    slug: 'uk-companies-house',
    displayName: 'Companies House',
    description: 'UK Companies House registry — company overview, filings, officers',
    runnerType: 'autonomous',
    outputType: 'attributes',
  },
  {
    slug: 'uk-jersey-financial-services-commission',
    displayName: 'Jersey FSC',
    description: 'Jersey Financial Services Commission registry',
    runnerType: 'autonomous',
    outputType: 'attributes',
  },
  {
    slug: 'uk-parent-flow',
    displayName: 'UK Orchestration Flow',
    description: 'Orchestrates all UK-registered agents end-to-end',
    runnerType: 'autonomous',
    outputType: 'both',
  },
  {
    slug: 'sanctions',
    displayName: 'Sanctions Screening',
    description: 'Screens against OFAC, EU, UN, and HMT lists',
    runnerType: 'autonomous',
    outputType: 'exceptions',
  },
  {
    slug: 'adverse-media',
    displayName: 'Adverse Media',
    description: 'Scans news sources for negative coverage',
    runnerType: 'autonomous',
    outputType: 'exceptions',
  },
  {
    slug: 'beneficial-owner',
    displayName: 'Beneficial Ownership',
    description: 'Builds 25%+ ownership tree',
    runnerType: 'autonomous',
    outputType: 'attributes',
  },
  {
    slug: 'pep',
    displayName: 'PEP Screening',
    description: 'Politically Exposed Person screening (Dow Jones / WorldCheck)',
    runnerType: 'autonomous',
    outputType: 'exceptions',
  },
];

export function getRegistryEntry(slug: string): AgentRegistryEntry | undefined {
  return AGENT_REGISTRY.find(e => e.slug === slug);
}
