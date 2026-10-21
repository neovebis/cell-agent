/**
 * Curated model catalog per provider (no backend route lists models, and provider
 * list endpoints require the user's secret key, which the app never handles).
 * IDs verified against each provider's official docs on 2026-10-21.
 */
export interface ModelOption {
  id: string;
  label: string;
  note?: string;
}

export const MODEL_CATALOG: Record<string, ModelOption[]> = {
  google: [
    { id: 'gemini-4-argon', label: 'Gemini 4 Argon', note: 'Topo de gama, raciocínio' },
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', note: 'Rápido, agentes' },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', note: 'Mais económico' },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview)' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', note: 'Legado' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Legado' },
  ],
  openai: [
    { id: 'gpt-6-astra', label: 'GPT-6 Astra', note: 'Topo de gama' },
    { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', note: 'Equilíbrio custo/qualidade' },
    { id: 'gpt-6-sol', label: 'GPT-6 Sol' },
    { id: 'gpt-6-luna', label: 'GPT-6 Luna', note: 'Mais económico' },
  ],
  anthropic: [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Recomendado' },
    { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', note: 'Raciocínio exigente' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Rápido' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'Mais económico' },
    { id: 'claude-opus-5', label: 'Claude Opus 5', note: 'Legado' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Legado' },
  ],
  groq: [
    { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
    { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', note: 'Muito rápido' },
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
    { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B (preview)' },
  ],
  mistral: [
    { id: 'mistral-large-4', label: 'Mistral Large 4 (preview)' },
    { id: 'mistral-medium-3-5', label: 'Mistral Medium 3.5', note: 'Agentes e código' },
    { id: 'mistral-large-2512', label: 'Mistral Large 3' },
    { id: 'mistral-small-2603', label: 'Mistral Small 4', note: 'Económico' },
    { id: 'ministral-8b-2512', label: 'Ministral 3 8B' },
    { id: 'codestral-2508', label: 'Codestral' },
  ],
  deepseek: [
    { id: 'deepseek-flash', label: 'DeepSeek Flash (V4.1)', note: 'Rápido, económico' },
    { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  ],
};

export const modelsFor = (provider: string): ModelOption[] => MODEL_CATALOG[provider] || [];

export const defaultModelFor = (provider: string): string => modelsFor(provider)[0]?.id || '';

export const isKnownModel = (provider: string, model: string): boolean =>
  modelsFor(provider).some((m) => m.id === model);

/** Preferred default from a live list: first curated model the key has, else the first live one. */
export function preferredModel(provider: string, live: { id: string }[]): string {
  const ids = new Set(live.map((m) => m.id));
  return modelsFor(provider).find((m) => ids.has(m.id))?.id || live[0]?.id || defaultModelFor(provider);
}
