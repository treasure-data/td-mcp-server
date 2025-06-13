import { CDP_ENDPOINTS } from './endpoints';
import { 
  ParentSegment, 
  Segment, 
  SegmentDetails,
  SegmentQueryRequest,
  SegmentQueryResponse,
  Activation, 
  CDPApiError,
  CDPRequestOptions 
} from '../../types/cdp';
import { maskApiKey } from '../../config';

export class CDPClient {
  private readonly apiKey: string;
  private readonly endpoint: string;

  constructor(apiKey: string, site: string) {
    this.apiKey = apiKey;
    const endpoint = CDP_ENDPOINTS[site];
    
    if (!endpoint) {
      throw new Error(`Unknown site: ${site}`);
    }
    
    this.endpoint = endpoint;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: CDPRequestOptions
  ): Promise<T> {
    const url = `${this.endpoint}${path}`;
    
    const headers: Record<string, string> = {
      'Authorization': `TD1 ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.treasuredata.v1+json',
      ...(options?.headers || {})
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `CDP API Error: HTTP ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorBody);
          errorMessage += ` - ${errorJson.message || errorJson.error || errorBody}`;
        } catch {
          errorMessage += ` - ${errorBody}`;
        }

        const error = new Error(errorMessage) as CDPApiError;
        error.statusCode = response.status;
        error.responseBody = errorBody;
        throw error;
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof Error) {
        // Mask API key in error messages
        error.message = error.message.replace(this.apiKey, maskApiKey(this.apiKey));
      }
      throw error;
    }
  }

  async getParentSegments(): Promise<ParentSegment[]> {
    const response = await this.request<any>('GET', '/entities/parent_segments');
    
    // Handle JSON:API format response
    if (Array.isArray(response)) {
      return response.map(item => item.data || item).filter(Boolean);
    }
    
    return response.data || [];
  }

  async getParentSegment(id: number): Promise<ParentSegment> {
    const response = await this.request<any>('GET', `/entities/parent_segments/${id}`);
    return response.data || response;
  }

  async getSegments(parentId: number): Promise<Segment[]> {
    const response = await this.request<Segment[]>('GET', `/audiences/${parentId}/segments`);
    return response || [];
  }

  async getActivations(parentId: number, segmentId: number): Promise<Activation[]> {
    const response = await this.request<any>(
      'GET',
      `/audiences/${parentId}/segments/${segmentId}/syndications`
    );
    
    // Handle JSON:API format response
    if (Array.isArray(response)) {
      return response.map(item => item.data || item).filter(Boolean);
    }
    
    return response.data || [];
  }

  async getSegmentDetails(parentId: number, segmentId: number): Promise<SegmentDetails> {
    const response = await this.request<SegmentDetails>(
      'GET',
      `/audiences/${parentId}/segments/${segmentId}`
    );
    return response;
  }

  async getSegmentQuery(parentId: number, request: SegmentQueryRequest): Promise<SegmentQueryResponse> {
    const response = await this.request<SegmentQueryResponse>(
      'POST',
      `/audiences/${parentId}/segments/query`,
      { body: request }
    );
    return response;
  }
}

export function createCDPClient(apiKey: string, site: string): CDPClient {
  return new CDPClient(apiKey, site);
}