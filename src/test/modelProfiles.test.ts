import { afterEach, describe, expect, it } from "vitest";
import {
  listModelProfiles,
  modelProfileForProvider,
  resolveModelProfile,
  sanitizeAnthropicRequest,
} from "../../agents/models/claude.js";

const managedEnvironment = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_CLAUDE_HAIKU_MODEL_ID",
  "AWS_BEARER_TOKEN_BEDROCK",
  "AWS_REGION",
  "BEDROCK_CLAUDE_HAIKU_MODEL_ID",
] as const;
const originalEnvironment = Object.fromEntries(managedEnvironment.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of managedEnvironment) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Claude model profiles", () => {
  it("maps a tier between equivalent providers", () => {
    expect(modelProfileForProvider("bedrock-claude-sonnet", "anthropic"))
      .toBe("anthropic-claude-sonnet");
    expect(modelProfileForProvider("anthropic-claude-haiku", "aws-bedrock"))
      .toBe("bedrock-claude-haiku");
  });

  it("reports provider readiness independently", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_CLAUDE_HAIKU_MODEL_ID = "claude-test";
    delete process.env.AWS_BEARER_TOKEN_BEDROCK;
    delete process.env.AWS_REGION;
    delete process.env.BEDROCK_CLAUDE_HAIKU_MODEL_ID;

    const profiles = listModelProfiles();
    expect(profiles.find((profile) => profile.key === "anthropic-claude-haiku")?.available).toBe(true);
    expect(profiles.find((profile) => profile.key === "bedrock-claude-haiku")?.available).toBe(false);
    expect(resolveModelProfile("anthropic-claude-haiku")).toMatchObject({
      provider: "anthropic",
      modelId: "claude-test",
    });
  });

  it("rejects an unconfigured target before a provider switch", () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_CLAUDE_HAIKU_MODEL_ID;
    expect(() => resolveModelProfile("anthropic-claude-haiku"))
      .toThrow(/ANTHROPIC_API_KEY/);
  });

  it("removes deprecated temperature settings from Anthropic requests", () => {
    expect(sanitizeAnthropicRequest({
      model: "runner-selected-model",
      max_tokens: 1024,
      temperature: 0,
      messages: [{ role: "user", content: "test" }],
    }, "claude-sonnet-4-6")).toEqual({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: "test" }],
    });
  });
});
