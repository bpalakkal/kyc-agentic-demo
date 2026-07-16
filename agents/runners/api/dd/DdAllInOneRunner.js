import { makeAllInOneRunner } from '../DdRunner.js';

/**
 * DdAllInOneRunner — sends full entity_data to Claude in one call.
 * Used by POST /api/entity/:kycRef/dd/run (no slugs) for efficient full-DD.
 */
export const DdAllInOneRunner = makeAllInOneRunner();
