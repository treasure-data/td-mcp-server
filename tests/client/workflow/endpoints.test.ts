import { describe, it, expect } from 'vitest';
import { getWorkflowEndpoint, transformToWorkflowEndpoint, WORKFLOW_ENDPOINTS } from '../../../src/client/workflow/endpoints';

describe('Workflow Endpoints', () => {
  describe('WORKFLOW_ENDPOINTS', () => {
    it('should have all supported sites', () => {
      expect(WORKFLOW_ENDPOINTS).toHaveProperty('us01');
      expect(WORKFLOW_ENDPOINTS).toHaveProperty('jp01');
      expect(WORKFLOW_ENDPOINTS).toHaveProperty('eu01');
      expect(WORKFLOW_ENDPOINTS).toHaveProperty('ap02');
      expect(WORKFLOW_ENDPOINTS).toHaveProperty('ap03');
      expect(WORKFLOW_ENDPOINTS).toHaveProperty('dev');
    });

    it('should have correct endpoint URLs', () => {
      expect(WORKFLOW_ENDPOINTS.us01).toBe('https://api-workflow.treasuredata.com');
      expect(WORKFLOW_ENDPOINTS.jp01).toBe('https://api-workflow.treasuredata.co.jp');
      expect(WORKFLOW_ENDPOINTS.eu01).toBe('https://api-workflow.eu01.treasuredata.com');
      expect(WORKFLOW_ENDPOINTS.ap02).toBe('https://api-workflow.ap02.treasuredata.com');
      expect(WORKFLOW_ENDPOINTS.ap03).toBe('https://api-workflow.ap03.treasuredata.com');
      expect(WORKFLOW_ENDPOINTS.dev).toBe('https://api-development-workflow.us01.treasuredata.com');
    });
  });

  describe('getWorkflowEndpoint', () => {
    it('should return correct endpoint for valid sites', () => {
      expect(getWorkflowEndpoint('us01')).toBe('https://api-workflow.treasuredata.com');
      expect(getWorkflowEndpoint('jp01')).toBe('https://api-workflow.treasuredata.co.jp');
      expect(getWorkflowEndpoint('eu01')).toBe('https://api-workflow.eu01.treasuredata.com');
      expect(getWorkflowEndpoint('dev')).toBe('https://api-development-workflow.us01.treasuredata.com');
    });

    it('should throw error for unsupported site', () => {
      expect(() => getWorkflowEndpoint('invalid' as any)).toThrow('Unsupported TD site: invalid');
    });
  });

  describe('transformToWorkflowEndpoint', () => {
    it('should transform production endpoints correctly', () => {
      expect(transformToWorkflowEndpoint('api.treasuredata.com'))
        .toBe('https://api-workflow.treasuredata.com');
      
      expect(transformToWorkflowEndpoint('api.treasuredata.co.jp'))
        .toBe('https://api-workflow.treasuredata.co.jp');
      
      expect(transformToWorkflowEndpoint('api.eu01.treasuredata.com'))
        .toBe('https://api-workflow.eu01.treasuredata.com');
      
      expect(transformToWorkflowEndpoint('api.ap02.treasuredata.com'))
        .toBe('https://api-workflow.ap02.treasuredata.com');
      
      expect(transformToWorkflowEndpoint('api.ap03.treasuredata.com'))
        .toBe('https://api-workflow.ap03.treasuredata.com');
    });

    it('should transform development endpoints correctly', () => {
      expect(transformToWorkflowEndpoint('api-development.treasuredata.com'))
        .toBe('https://api-development-workflow.treasuredata.com');
      
      expect(transformToWorkflowEndpoint('api-development.connect.treasuredata.com'))
        .toBe('https://api-development-workflow.connect.treasuredata.com');
      
      expect(transformToWorkflowEndpoint('api-staging.connect.treasuredata.com'))
        .toBe('https://api-staging-workflow.connect.treasuredata.com');
    });

    it('should transform endpoints with suffixes correctly', () => {
      expect(transformToWorkflowEndpoint('api-development-test.connect.treasuredata.com'))
        .toBe('https://api-development-workflow-test.connect.treasuredata.com');
      
      expect(transformToWorkflowEndpoint('api-staging-feature.connect.treasuredata.com'))
        .toBe('https://api-staging-workflow-feature.connect.treasuredata.com');
    });

    it('should handle case insensitive matching', () => {
      expect(transformToWorkflowEndpoint('API.TreasureData.COM'))
        .toBe('https://api-workflow.treasuredata.com');
    });

    it('should throw error for invalid endpoint format', () => {
      expect(() => transformToWorkflowEndpoint('invalid.endpoint.com'))
        .toThrow('Invalid API endpoint format: invalid.endpoint.com');
      
      expect(() => transformToWorkflowEndpoint('https://api.treasuredata.com'))
        .toThrow('Invalid API endpoint format: https://api.treasuredata.com');
      
      expect(() => transformToWorkflowEndpoint('api.treasuredata'))
        .toThrow('Invalid API endpoint format: api.treasuredata');
    });
  });
});