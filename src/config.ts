import { Config, TDSite } from './types';

/**
 * Error thrown when configuration validation fails
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

const VALID_SITES: readonly TDSite[] = ['us01', 'jp01', 'eu01', 'ap02', 'ap03', 'dev'];

/**
 * Loads and validates configuration from environment variables
 * @returns Validated configuration object
 * @throws {ConfigurationError} If configuration is invalid or missing required values
 */
export function loadConfig(): Config {
  const config: Config = {
    td_api_key: process.env.TD_API_KEY || '',
    site: (process.env.TD_SITE as TDSite) || 'us01',
    enable_updates: process.env.TD_ENABLE_UPDATES === 'true',
    database: process.env.TD_DATABASE,
    llm_api_base: process.env.TD_LLM_API_BASE,
    default_project_name: process.env.TD_DEFAULT_PROJECT_NAME,
    default_agent_id: process.env.TD_DEFAULT_AGENT_ID,
  };

  validateConfig(config);
  return config;
}

/**
 * Validates the configuration object
 * @param config - Configuration to validate
 * @throws {ConfigurationError} If configuration is invalid
 */
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

/**
 * Gets configuration from arguments with environment variable fallback
 * @param args - Optional configuration arguments
 * @returns Validated configuration object
 * @throws {ConfigurationError} If configuration is invalid
 */
export function getConfigFromArgs(args?: Record<string, unknown>): Config {
  // Support both environment variables and direct args
  const config: Config = {
    td_api_key: (args?.td_api_key as string) || process.env.TD_API_KEY || '',
    site: (args?.site as TDSite) || (process.env.TD_SITE as TDSite) || 'us01',
    enable_updates:
      args?.enable_updates === true ||
      args?.enable_updates === 'true' ||
      process.env.TD_ENABLE_UPDATES === 'true',
    database: (args?.database as string) || process.env.TD_DATABASE,
    llm_api_base: (args?.llm_api_base as string) || process.env.TD_LLM_API_BASE,
    default_project_name:
      (args?.default_project_name as string) || process.env.TD_DEFAULT_PROJECT_NAME,
    default_agent_id: (args?.default_agent_id as string) || process.env.TD_DEFAULT_AGENT_ID,
  };

  validateConfig(config);
  return config;
}

/**
 * Masks an API key for safe display in logs
 * @param apiKey - The API key to mask
 * @returns Masked API key showing only first 4 and last 4 characters
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '***';
  }
  return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
}

/**
 * Gets a human-readable summary of the configuration
 * @param config - Configuration object
 * @returns Formatted configuration summary with masked sensitive data
 */
export function getConfigSummary(config: Config): string {
  return `TD MCP Server Configuration:
  - Site: ${config.site}
  - API Key: ${maskApiKey(config.td_api_key)}
  - Updates Enabled: ${config.enable_updates || false}
  - Default Database: ${config.database || 'none'}
  - LLM API Base: ${config.llm_api_base || 'default'}`;
}