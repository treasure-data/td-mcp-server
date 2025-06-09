import { TDSite } from '../types';

export const TD_ENDPOINTS: Record<TDSite, string> = {
  us01: 'https://api-presto.treasuredata.com',
  jp01: 'https://api-presto.treasuredata.co.jp',
  eu01: 'https://api-presto.eu01.treasuredata.com',
  ap02: 'https://api-presto.ap02.treasuredata.com',
  ap03: 'https://api-presto.ap03.treasuredata.com',
  dev: 'https://api-development-presto.treasuredata.com',
} as const;

export function getEndpointForSite(site: TDSite): string {
  const endpoint = TD_ENDPOINTS[site];
  if (!endpoint) {
    throw new Error(`Unknown TD site: ${site}`);
  }
  return endpoint;
}

export function getTrinoPort(): number {
  // All TD Presto/Trino endpoints use HTTPS on port 443
  return 443;
}

export function getCatalog(): string {
  // TD always uses 'td' as the catalog name
  return 'td';
}