/**
 * agents/dd — DD infrastructure barrel export.
 *
 * Re-exports the four DD utility modules so runners can import from a single
 * location: `import { buildEntityDataJson, deltaToAttributes, agentsToRun,
 * normalizeForAttribute } from '../dd/index.js'`
 */
export { buildEntityDataJson, entityDataToAttributes } from './entityData.js';
export { deltaToAttributes, extractResults } from './ddDelta.js';
export { agentsToRun, entityTypeForCase } from './gate.js';
export { normalizeForAttribute, normalizeEnum, resolveEnumPath } from './enumNormalizer.js';
