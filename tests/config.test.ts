import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadConfig,
  validateConfig,
  getConfigFromArgs,
  maskApiKey,
  getConfigSummary,
  ConfigurationError,
} from '../src/config';
import { Config } from '../src/types';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load config from environment variables', () => {
      process.env.TD_API_KEY = 'test-api-key-12345';
      process.env.TD_SITE = 'jp01';
      process.env.TD_ENABLE_UPDATES = 'true';

      const config = loadConfig();

      expect(config.td_api_key).toBe('test-api-key-12345');
      expect(config.site).toBe('jp01');
      expect(config.enable_updates).toBe(true);
    });

    it('should use default values when env vars not set', () => {
      process.env.TD_API_KEY = 'test-api-key-12345';

      const config = loadConfig();

      expect(config.site).toBe('us01');
      expect(config.enable_updates).toBe(false);
      expect(config.llm_api_base).toBeUndefined();
    });

    it('should throw error when API key is missing', () => {
      delete process.env.TD_API_KEY;

      expect(() => loadConfig()).toThrow(ConfigurationError);
      expect(() => loadConfig()).toThrow('TD_API_KEY is required');
    });
  });

  describe('validateConfig', () => {
    const validConfig: Config = {
      td_api_key: 'test-api-key-12345',
      site: 'us01',
    };

    it('should accept valid configuration', () => {
      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    it('should reject empty API key', () => {
      const config = { ...validConfig, td_api_key: '' };
      expect(() => validateConfig(config)).toThrow('TD_API_KEY is required');
    });

    it('should reject short API key', () => {
      const config = { ...validConfig, td_api_key: 'short' };
      expect(() => validateConfig(config)).toThrow('TD_API_KEY appears to be invalid');
    });

    it('should reject invalid site', () => {
      const config = { ...validConfig, site: 'invalid' as any };
      expect(() => validateConfig(config)).toThrow('Invalid TD_SITE: invalid');
    });

    it('should accept all valid sites', () => {
      const sites = ['us01', 'jp01', 'eu01', 'ap02', 'ap03', 'dev'] as const;
      sites.forEach((site) => {
        const config = { ...validConfig, site };
        expect(() => validateConfig(config)).not.toThrow();
      });
    });

    it('should validate LLM API base URL', () => {
      const validUrl = { ...validConfig, llm_api_base: 'https://api.example.com' };
      expect(() => validateConfig(validUrl)).not.toThrow();

      const invalidUrl = { ...validConfig, llm_api_base: 'not-a-url' };
      expect(() => validateConfig(invalidUrl)).toThrow('Invalid TD_LLM_API_BASE URL');
    });
  });

  describe('getConfigFromArgs', () => {
    it('should prioritize args over environment variables', () => {
      process.env.TD_API_KEY = 'env-api-key';
      process.env.TD_SITE = 'us01';

      const config = getConfigFromArgs({
        td_api_key: 'args-api-key',
        site: 'jp01',
      });

      expect(config.td_api_key).toBe('args-api-key');
      expect(config.site).toBe('jp01');
    });

    it('should fall back to env vars when args not provided', () => {
      process.env.TD_API_KEY = 'env-api-key';
      process.env.TD_SITE = 'eu01';

      const config = getConfigFromArgs({});

      expect(config.td_api_key).toBe('env-api-key');
      expect(config.site).toBe('eu01');
    });

    it('should handle enable_updates as boolean or string', () => {
      process.env.TD_API_KEY = 'test-api-key-12345';

      const boolConfig = getConfigFromArgs({ enable_updates: true });
      expect(boolConfig.enable_updates).toBe(true);

      const stringConfig = getConfigFromArgs({ enable_updates: 'true' });
      expect(stringConfig.enable_updates).toBe(true);

      const falseConfig = getConfigFromArgs({ enable_updates: false });
      expect(falseConfig.enable_updates).toBe(false);
    });
  });

  describe('maskApiKey', () => {
    it('should mask API key properly', () => {
      expect(maskApiKey('1234567890abcdef')).toBe('1234...cdef');
      expect(maskApiKey('short')).toBe('***');
      expect(maskApiKey('')).toBe('***');
    });
  });

  describe('getConfigSummary', () => {
    it('should generate config summary', () => {
      const config: Config = {
        td_api_key: 'test-api-key-12345',
        site: 'jp01',
        enable_updates: true,
        llm_api_base: 'https://llm.example.com',
      };

      const summary = getConfigSummary(config);

      expect(summary).toContain('Site: jp01');
      expect(summary).toContain('API Key: test...2345');
      expect(summary).toContain('Updates Enabled: true');
      expect(summary).toContain('LLM API Base: https://llm.example.com');
    });

    it('should show defaults in summary', () => {
      const config: Config = {
        td_api_key: 'test-api-key',
        site: 'us01',
      };

      const summary = getConfigSummary(config);

      expect(summary).toContain('Updates Enabled: false');
      expect(summary).toContain('LLM API Base: default');
    });
  });
});