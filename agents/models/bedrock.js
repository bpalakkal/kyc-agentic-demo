export {
  listModelProfiles,
  isKnownModelProfile,
  resolveModelProfile,
  createClaudeClient,
  modelProfileForProvider,
} from './claude.js';

// Backward-compatible alias for out-of-tree integrations.
export { createClaudeClient as createBedrockClaudeClient } from './claude.js';
