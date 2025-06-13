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