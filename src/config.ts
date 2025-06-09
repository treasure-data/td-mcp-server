import { Config, TDSite } from './types.js';

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

const VALID_SITES: readonly TDSite[] = ['us01', 'jp01', 'eu01', 'ap02', 'ap03', 'dev'];

export function loadConfig(): Config {
  const config: Config = {
    td_api_key: process.env.TD_API_KEY || '',
    site: (process.env.TD_SITE as TDSite) || 'us01',
    enable_updates: process.env.TD_ENABLE_UPDATES === 'true',
    llm_api_base: process.env.TD_LLM_API_BASE,
    default_project_name: process.env.TD_DEFAULT_PROJECT_NAME,
    default_agent_id: process.env.TD_DEFAULT_AGENT_ID,
  };

  validateConfig(config);
  return config;
}

export function validateConfig(config: Config): void {
  // Validate API key
  if (!config.td_api_key) {
    throw new ConfigurationError('TD_API_KEY is required but not provided');
  }

  if (config.td_api_key.length < 10) {
    throw new ConfigurationError('TD_API_KEY appears to be invalid (too short)');
  }

  // Validate site
  if (!VALID_SITES.includes(config.site)) {
    throw new ConfigurationError(
      `Invalid TD_SITE: ${config.site}. Must be one of: ${VALID_SITES.join(', ')}`
    );
  }

  // Validate LLM API base if provided
  if (config.llm_api_base) {
    try {
      new URL(config.llm_api_base);
    } catch {
      throw new ConfigurationError(`Invalid TD_LLM_API_BASE URL: ${config.llm_api_base}`);
    }
  }
}

export function getConfigFromArgs(args?: Record<string, unknown>): Config {
  // Support both environment variables and direct args
  const config: Config = {
    td_api_key: (args?.td_api_key as string) || process.env.TD_API_KEY || '',
    site: (args?.site as TDSite) || (process.env.TD_SITE as TDSite) || 'us01',
    enable_updates:
      args?.enable_updates === true ||
      args?.enable_updates === 'true' ||
      process.env.TD_ENABLE_UPDATES === 'true',
    llm_api_base: (args?.llm_api_base as string) || process.env.TD_LLM_API_BASE,
    default_project_name:
      (args?.default_project_name as string) || process.env.TD_DEFAULT_PROJECT_NAME,
    default_agent_id: (args?.default_agent_id as string) || process.env.TD_DEFAULT_AGENT_ID,
  };

  validateConfig(config);
  return config;
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '***';
  }
  return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
}

export function getConfigSummary(config: Config): string {
  return `TD MCP Server Configuration:
  - Site: ${config.site}
  - API Key: ${maskApiKey(config.td_api_key)}
  - Updates Enabled: ${config.enable_updates || false}
  - LLM API Base: ${config.llm_api_base || 'default'}`;
}