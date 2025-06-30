import { TDSite } from '../../types.js';

/**
 * Maps TD sites to workflow API endpoints
 * Pattern: /\Aapi(-(?:staging|development))?(-[a-z0-9]+)?\.(connect\.)?((?:eu01|ap02|ap03)\.)?treasuredata\.(com|co\.jp)\z/i
 * Transform: https://api#{$1}-workflow#{$2}.#{$3}#{$4}treasuredata.#{$5}
 */
export const WORKFLOW_ENDPOINTS: Record<TDSite, string> = {
  us01: 'https://api-workflow.treasuredata.com',
  jp01: 'https://api-workflow.treasuredata.co.jp',
  eu01: 'https://api-workflow.eu01.treasuredata.com',
  ap02: 'https://api-workflow.ap02.treasuredata.com',
  ap03: 'https://api-workflow.ap03.treasuredata.com',
  dev: 'https://api-development-workflow.connect.treasuredata.com',
};

/**
 * Get workflow API endpoint for a given site
 */
export function getWorkflowEndpoint(site: TDSite): string {
  const endpoint = WORKFLOW_ENDPOINTS[site];
  if (!endpoint) {
    throw new Error(`Unsupported TD site: ${site}`);
  }
  return endpoint;
}

/**
 * Transform a base API endpoint to workflow endpoint
 * This handles custom staging/development endpoints with suffixes
 */
export function transformToWorkflowEndpoint(apiEndpoint: string): string {
  const regex = /^api(-(?:staging|development))?(-[a-z0-9]+)?\.(connect\.)?((?:eu01|ap02|ap03)\.)?treasuredata\.(com|co\.jp)$/i;
  const match = apiEndpoint.match(regex);
  
  if (!match) {
    throw new Error(`Invalid API endpoint format: ${apiEndpoint}`);
  }
  
  const [, envPrefix, suffix, connectDomain, regionPrefix, tld] = match;
  
  return `https://api${envPrefix || ''}-workflow${suffix || ''}.${connectDomain || ''}${regionPrefix || ''}treasuredata.${tld}`;
}