import type { AgentConfig, AgentGrants } from '../types';

const CONFIG_FIELDS = [
  'provider',
  'model',
  'credentialId',
  'systemPrompt',
  'maxModelCalls',
  'maxToolCalls',
  'maxOutputTokens',
  'maxDurationSeconds',
  'concurrency',
] as const;
const GRANT_FIELDS = [
  'editGraph',
  'executeCode',
  'webSearch',
  'teams',
  'externalEffects',
  'executeNodes',
  'credentialIds',
  'variableNames',
] as const;

function pick(
  value: unknown,
  fields: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    fields
      .filter((key) => Object.hasOwn(source, key) && source[key] !== undefined)
      .map((key) => [key, source[key]]),
  );
}

/** Only the existing central-agent API fields may cross the transport boundary. */
export function centralAgentConfig(value: unknown): AgentConfig {
  return {
    provider: '',
    model: '',
    ...pick(value, CONFIG_FIELDS),
  } as AgentConfig;
}

export function centralAgentGrants(value: unknown): AgentGrants {
  const source = pick(value, GRANT_FIELDS);
  return {
    editGraph: source.editGraph === true,
    executeCode: source.executeCode === true,
    teams: source.teams === true,
    externalEffects: source.externalEffects === true,
    ...(source.webSearch === undefined
      ? {}
      : { webSearch: source.webSearch === true }),
    executeNodes: Array.isArray(source.executeNodes)
      ? [...source.executeNodes]
      : [],
    credentialIds: Array.isArray(source.credentialIds)
      ? [...source.credentialIds]
      : [],
    variableNames: Array.isArray(source.variableNames)
      ? [...source.variableNames]
      : [],
  };
}

export function centralAgentPayload(
  config: AgentConfig,
  grants: AgentGrants | undefined,
) {
  return { ...centralAgentConfig(config), grants: centralAgentGrants(grants) };
}

export function agentProfileReady(config: AgentConfig | undefined): boolean {
  return Boolean(
    config?.provider?.trim() &&
    config.model?.trim() &&
    config.credentialId?.trim(),
  );
}
