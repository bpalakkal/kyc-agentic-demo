import Anthropic from '@anthropic-ai/sdk';

const MODEL_PROFILES = Object.freeze({
  'bedrock-claude-haiku': {
    provider: 'aws-bedrock', tier: 'haiku',
    modelEnv: 'BEDROCK_CLAUDE_HAIKU_MODEL_ID',
    displayName: 'Claude Haiku on Amazon Bedrock',
  },
  'bedrock-claude-sonnet': {
    provider: 'aws-bedrock', tier: 'sonnet',
    modelEnv: 'BEDROCK_CLAUDE_SONNET_MODEL_ID',
    displayName: 'Claude Sonnet on Amazon Bedrock',
  },
  'bedrock-claude-opus': {
    provider: 'aws-bedrock', tier: 'opus',
    modelEnv: 'BEDROCK_CLAUDE_OPUS_MODEL_ID',
    displayName: 'Claude Opus on Amazon Bedrock',
  },
  'anthropic-claude-haiku': {
    provider: 'anthropic', tier: 'haiku',
    modelEnv: 'ANTHROPIC_CLAUDE_HAIKU_MODEL_ID',
    displayName: 'Claude Haiku via Anthropic API',
  },
  'anthropic-claude-sonnet': {
    provider: 'anthropic', tier: 'sonnet',
    modelEnv: 'ANTHROPIC_CLAUDE_SONNET_MODEL_ID',
    displayName: 'Claude Sonnet via Anthropic API',
  },
  'anthropic-claude-opus': {
    provider: 'anthropic', tier: 'opus',
    modelEnv: 'ANTHROPIC_CLAUDE_OPUS_MODEL_ID',
    displayName: 'Claude Opus via Anthropic API',
  },
});

function missingEnvironment(profile) {
  return profile.provider === 'aws-bedrock'
    ? ['AWS_BEARER_TOKEN_BEDROCK', 'AWS_REGION', profile.modelEnv].filter(key => !process.env[key])
    : ['ANTHROPIC_API_KEY', profile.modelEnv].filter(key => !process.env[key]);
}

export function listModelProfiles() {
  return Object.entries(MODEL_PROFILES).map(([key, profile]) => ({
    key,
    provider: profile.provider,
    tier: profile.tier,
    display_name: profile.displayName,
    model_env: profile.modelEnv,
    available: missingEnvironment(profile).length === 0,
  }));
}

export function isKnownModelProfile(profileKey) {
  return Boolean(MODEL_PROFILES[profileKey]);
}

export function modelProfileForProvider(profileKey, provider) {
  const profile = MODEL_PROFILES[profileKey];
  if (!profile) throw new Error(`Unknown model profile "${profileKey}"`);
  if (!['aws-bedrock', 'anthropic'].includes(provider)) {
    throw new Error(`Unsupported model provider "${provider}"`);
  }
  return `${provider === 'aws-bedrock' ? 'bedrock' : 'anthropic'}-claude-${profile.tier}`;
}

export function resolveModelProfile(profileKey) {
  const profile = MODEL_PROFILES[profileKey];
  if (!profile) throw new Error(`Unknown model profile "${profileKey}"`);
  const missing = missingEnvironment(profile);
  if (missing.length) throw new Error(`Model profile "${profileKey}" is unavailable: missing ${missing.join(', ')}`);
  return {
    key: profileKey,
    provider: profile.provider,
    tier: profile.tier,
    displayName: profile.displayName,
    modelId: process.env[profile.modelEnv],
    ...(profile.provider === 'aws-bedrock' ? { region: process.env.AWS_REGION } : {}),
  };
}

function createBedrockClient(profile) {
  return {
    profile,
    messages: {
      async create(request) {
        const { model: _ignoredModel, ...input } = request;
        const endpoint = `https://bedrock-runtime.${profile.region}.amazonaws.com/model/${encodeURIComponent(profile.modelId)}/invoke`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.AWS_BEARER_TOKEN_BEDROCK}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ anthropic_version: 'bedrock-2023-05-31', ...input }),
          signal: AbortSignal.timeout(180_000),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const detail = payload.message ?? payload.error?.message ?? JSON.stringify(payload);
          throw new Error(`Amazon Bedrock ${response.status}: ${detail}`);
        }
        return payload;
      },
    },
  };
}

function createAnthropicClient(profile) {
  const sdk = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return {
    profile,
    messages: {
      create(request) {
        return sdk.messages.create({ ...request, model: profile.modelId });
      },
    },
  };
}

export function createClaudeClient(profileKey) {
  const profile = resolveModelProfile(profileKey);
  return profile.provider === 'anthropic'
    ? createAnthropicClient(profile)
    : createBedrockClient(profile);
}
