const MODEL_PROFILES = Object.freeze({
  'bedrock-claude-haiku': {
    provider: 'aws-bedrock',
    modelEnv: 'BEDROCK_CLAUDE_HAIKU_MODEL_ID',
    displayName: 'Claude Haiku on Amazon Bedrock',
  },
  'bedrock-claude-sonnet': {
    provider: 'aws-bedrock',
    modelEnv: 'BEDROCK_CLAUDE_SONNET_MODEL_ID',
    displayName: 'Claude Sonnet on Amazon Bedrock',
  },
  'bedrock-claude-opus': {
    provider: 'aws-bedrock',
    modelEnv: 'BEDROCK_CLAUDE_OPUS_MODEL_ID',
    displayName: 'Claude Opus on Amazon Bedrock',
  },
});

export function listModelProfiles() {
  return Object.entries(MODEL_PROFILES).map(([key, profile]) => ({
    key,
    provider: profile.provider,
    display_name: profile.displayName,
    model_env: profile.modelEnv,
    available: Boolean(process.env.AWS_BEARER_TOKEN_BEDROCK && process.env.AWS_REGION && process.env[profile.modelEnv]),
  }));
}

export function isKnownModelProfile(profileKey) {
  return Boolean(MODEL_PROFILES[profileKey]);
}

export function resolveModelProfile(profileKey) {
  const profile = MODEL_PROFILES[profileKey];
  if (!profile) throw new Error(`Unknown model profile "${profileKey}"`);
  const missing = ['AWS_BEARER_TOKEN_BEDROCK', 'AWS_REGION', profile.modelEnv]
    .filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Model profile "${profileKey}" is unavailable: missing ${missing.join(', ')}`);
  return {
    key: profileKey,
    provider: profile.provider,
    displayName: profile.displayName,
    modelId: process.env[profile.modelEnv],
    region: process.env.AWS_REGION,
  };
}

export function createBedrockClaudeClient(profileKey) {
  const profile = resolveModelProfile(profileKey);
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
