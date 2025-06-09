import { getEndpointForSite, getTrinoPort, getCatalog, TD_ENDPOINTS } from '../../src/client/endpoints';
import { TDSite } from '../../src/types';

describe('TD Endpoints', () => {
  describe('TD_ENDPOINTS', () => {
    it('should have all required sites', () => {
      const expectedSites: TDSite[] = ['us01', 'jp01', 'eu01', 'ap02', 'ap03', 'dev'];
      expectedSites.forEach((site) => {
        expect(TD_ENDPOINTS[site]).toBeDefined();
        expect(TD_ENDPOINTS[site]).toMatch(/^https:\/\//);
      });
    });

    it('should have correct endpoints for each site', () => {
      expect(TD_ENDPOINTS.us01).toBe('https://api-presto.treasuredata.com');
      expect(TD_ENDPOINTS.jp01).toBe('https://api-presto.treasuredata.co.jp');
      expect(TD_ENDPOINTS.eu01).toBe('https://api-presto.eu01.treasuredata.com');
      expect(TD_ENDPOINTS.ap02).toBe('https://api-presto.ap02.treasuredata.com');
      expect(TD_ENDPOINTS.ap03).toBe('https://api-presto.ap03.treasuredata.com');
      expect(TD_ENDPOINTS.dev).toBe('https://api-development-presto.treasuredata.com');
    });
  });

  describe('getEndpointForSite', () => {
    it('should return correct endpoint for valid sites', () => {
      expect(getEndpointForSite('us01')).toBe('https://api-presto.treasuredata.com');
      expect(getEndpointForSite('jp01')).toBe('https://api-presto.treasuredata.co.jp');
    });

    it('should throw error for invalid site', () => {
      expect(() => getEndpointForSite('invalid' as TDSite)).toThrow('Unknown TD site: invalid');
    });
  });

  describe('getTrinoPort', () => {
    it('should return 443 for HTTPS', () => {
      expect(getTrinoPort()).toBe(443);
    });
  });

  describe('getCatalog', () => {
    it('should return td as catalog name', () => {
      expect(getCatalog()).toBe('td');
    });
  });
});