/**
 * CDP API type definitions
 */

export interface ParentSegment {
  id: string;
  type?: string;
  attributes?: {
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface Segment {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentDetails extends Segment {
  audienceId: string;
  realtime: boolean;
  isVisible: boolean;
  numSyndications: number;
  segmentFolderId: string;
  population: number;
  createdBy: {
    id: string;
    td_user_id: string;
    name: string;
  };
  updatedBy: {
    id: string;
    td_user_id: string;
    name: string;
  };
  kind: number;
  rule?: SegmentRule;
  referencedBy: unknown[];
}

export interface SegmentRule {
  type: string;
  conditions?: SegmentCondition[];
  description?: string;
}

export interface SegmentCondition {
  type: string;
  conditions?: SegmentCondition[];
  leftValue?: {
    name: string;
  };
  operator?: {
    not: boolean;
    rightValues?: string[];
    type: string;
  };
  exclude?: boolean;
  limit?: number | null;
  description?: string;
}

export interface SegmentQueryRequest {
  format: 'sql';
  rule?: SegmentRule;
}

export interface SegmentQueryResponse {
  sql: string;
}

export interface Activation {
  id: string;
  type?: string;
  attributes?: {
    name: string;
    description?: string;
    connectionId: string;
    lastWorkflowRun?: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface CDPApiError extends Error {
  statusCode?: number;
  responseBody?: string;
}

export interface CDPRequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
}

export interface CDPResponse<T> {
  data: T;
}