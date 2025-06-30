import { TDSite } from '../../types.js';
import { maskApiKey } from '../../config.js';
import { getWorkflowEndpoint } from './endpoints.js';
import type {
  WorkflowListResponse,
  SessionListResponse,
  AttemptsResponse,
  TasksResponse,
  LogsResponse,
  KillAttemptResponse,
  RetrySessionResponse,
  RetryAttemptResponse,
  ProjectListResponse,
  WorkflowStatus,
} from '../../types/workflow.js';

export interface WorkflowClientOptions {
  apiKey: string;
  site: TDSite;
  timeout?: number;
}

export class WorkflowClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: WorkflowClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = getWorkflowEndpoint(options.site);
    this.timeout = options.timeout || 30000; // 30 seconds default
  }

  /**
   * Make an HTTP request to the workflow API
   */
  private async request<T>(
    method: string,
    path: string,
    params?: Record<string, unknown>,
    body?: unknown
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    
    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Authorization': `TD1 ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Workflow API error (${response.status}): ${errorText}`
        );
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Mask API key in error messages
      if (error instanceof Error) {
        error.message = error.message.replace(this.apiKey, maskApiKey(this.apiKey));
      }
      
      throw error;
    }
  }

  /**
   * List all workflows in a project
   */
  async listWorkflows(params: {
    project_name: string;
    limit?: number;
    last_id?: string;
  }): Promise<WorkflowListResponse> {
    return this.request<WorkflowListResponse>(
      'GET',
      `/api/projects/${encodeURIComponent(params.project_name)}/workflows`,
      {
        page_size: params.limit,
        last_id: params.last_id,
      }
    );
  }

  /**
   * List workflow sessions with filtering
   */
  async listSessions(params: {
    project_name?: string;
    workflow_name?: string;
    status?: WorkflowStatus;
    from_time?: string;
    to_time?: string;
    limit?: number;
    last_id?: string;
  }): Promise<SessionListResponse> {
    const path = params.project_name && params.workflow_name
      ? `/api/projects/${encodeURIComponent(params.project_name)}/workflows/${encodeURIComponent(params.workflow_name)}/sessions`
      : '/api/sessions';

    return this.request<SessionListResponse>(
      'GET',
      path,
      {
        status: params.status,
        from_time: params.from_time,
        to_time: params.to_time,
        page_size: params.limit,
        last_id: params.last_id,
      }
    );
  }

  /**
   * Get attempts for a session
   */
  async getSessionAttempts(sessionId: string): Promise<AttemptsResponse> {
    return this.request<AttemptsResponse>(
      'GET',
      `/api/sessions/${sessionId}/attempts`
    );
  }

  /**
   * Get tasks within an attempt
   */
  async getAttemptTasks(attemptId: string, includeSubtasks = true): Promise<TasksResponse> {
    return this.request<TasksResponse>(
      'GET',
      `/api/attempts/${attemptId}/tasks`,
      {
        include_subtasks: includeSubtasks,
      }
    );
  }

  /**
   * Get logs for a specific task
   */
  async getTaskLogs(params: {
    attempt_id: string;
    task_name: string;
    offset?: number;
    limit?: number;
  }): Promise<LogsResponse> {
    return this.request<LogsResponse>(
      'GET',
      `/api/attempts/${params.attempt_id}/tasks/${encodeURIComponent(params.task_name)}/logs`,
      {
        offset: params.offset,
        limit: params.limit,
      }
    );
  }


  /**
   * Kill a running attempt
   */
  async killAttempt(attemptId: string, reason?: string): Promise<KillAttemptResponse> {
    return this.request<KillAttemptResponse>(
      'POST',
      `/api/attempts/${attemptId}/kill`,
      undefined,
      {
        reason,
      }
    );
  }

  /**
   * Retry a failed session
   */
  async retrySession(params: {
    session_id: string;
    from_task?: string;
    retry_params?: Record<string, unknown>;
  }): Promise<RetrySessionResponse> {
    return this.request<RetrySessionResponse>(
      'POST',
      `/api/sessions/${params.session_id}/retry`,
      undefined,
      {
        from_task: params.from_task,
        params: params.retry_params,
      }
    );
  }

  /**
   * Retry a specific attempt
   */
  async retryAttempt(params: {
    attempt_id: string;
    resume_from?: string;
    retry_params?: Record<string, unknown>;
    force?: boolean;
  }): Promise<RetryAttemptResponse> {
    return this.request<RetryAttemptResponse>(
      'POST',
      `/api/attempts/${params.attempt_id}/retry`,
      undefined,
      {
        resume_from: params.resume_from,
        params: params.retry_params,
        force: params.force,
      }
    );
  }

  /**
   * List all projects
   */
  async listProjects(params?: {
    limit?: number;
    last_id?: string;
  }): Promise<ProjectListResponse> {
    return this.request<ProjectListResponse>(
      'GET',
      '/api/projects',
      {
        page_size: params?.limit,
        last_id: params?.last_id,
      }
    );
  }
}