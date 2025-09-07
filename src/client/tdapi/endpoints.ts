import { TDSite } from '../../types';

/**
 * Mapping of Treasure Data sites to their main REST API endpoints
 */
export const TD_API_ENDPOINTS: Record<TDSite, string> = {
  us01: 'https://api.treasuredata.com',
  jp01: 'https://api.treasuredata.co.jp',
  eu01: 'https://api.eu01.treasuredata.com',
  ap02: 'https://api.ap02.treasuredata.com',
  ap03: 'https://api.ap03.treasuredata.com',
  // Development endpoint (best effort; can be overridden later if needed)
  dev: 'https://api-development.us01.treasuredata.com',
} as const;

export function getTdApiEndpointForSite(site: TDSite): string {
  const endpoint = TD_API_ENDPOINTS[site];
  if (!endpoint) throw new Error(`Unknown TD site: ${site}`);
  return endpoint;
}

