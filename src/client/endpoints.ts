import { TDSite } from '../types';

/**
 * Mapping of Treasure Data sites to their Trino API endpoints
 */
export const TD_ENDPOINTS: Record<TDSite, string> = {
  us01: 'https://api-presto.treasuredata.com',
  jp01: 'https://api-presto.treasuredata.co.jp',
  eu01: 'https://api-presto.eu01.treasuredata.com',
  ap02: 'https://api-presto.ap02.treasuredata.com',
  ap03: 'https://api-presto.ap03.treasuredata.com',
  dev: 'https://api-development-presto.treasuredata.com',
} as const;

/**
 * Gets the Trino API endpoint URL for a given Treasure Data site
 * @param site - The TD site identifier (us01, jp01, eu01, ap02, ap03, dev)
 * @returns The full HTTPS URL for the Trino API endpoint
 * @throws {Error} If the site is not recognized
 */
export function getEndpointForSite(site: TDSite): string {
  const endpoint = TD_ENDPOINTS[site];
  if (!endpoint) {
    throw new Error(`Unknown TD site: ${site}`);
  }
  return endpoint;
}

/**
 * Gets the default Trino port number
 * @returns The port number (443 for HTTPS)
 */
export function getTrinoPort(): number {
  // All TD Presto/Trino endpoints use HTTPS on port 443
  return 443;
}

/**
 * Gets the Trino catalog name for Treasure Data
 * @returns The catalog name ('td')
 */
export function getCatalog(): string {
  // TD always uses 'td' as the catalog name
  return 'td';
}