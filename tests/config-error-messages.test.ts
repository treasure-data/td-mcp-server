import { describe, it, expect } from 'vitest';
import { validateConfig } from '../src/config';

describe('Configuration Error Messages', () => {
  it('should not expose dev site in error messages', () => {
    const config = {
      td_api_key: 'test-api-key-12345',
      site: 'invalid-site' as any,
      enable_updates: false,
    };

    try {
      validateConfig(config);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      // Error message should list public sites but not 'dev'
      expect(error.message).toContain('us01');
      expect(error.message).toContain('jp01');
      expect(error.message).toContain('eu01');
      expect(error.message).toContain('ap02');
      expect(error.message).toContain('ap03');
      expect(error.message).not.toContain('dev');
      
      // Verify the exact format
      expect(error.message).toBe(
        'Invalid TD_SITE: invalid-site. Must be one of: us01, jp01, eu01, ap02, ap03'
      );
    }
  });

  it('should still accept dev as a valid site internally', () => {
    const config = {
      td_api_key: 'test-api-key-12345',
      site: 'dev' as any,
      enable_updates: false,
    };

    // Should not throw - dev is still valid internally
    expect(() => validateConfig(config)).not.toThrow();
  });
});