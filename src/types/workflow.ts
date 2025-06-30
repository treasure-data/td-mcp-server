// Workflow-related types

export type WorkflowStatus = 'running' | 'success' | 'error' | 'killed' | 'planned';
export type TaskState = 'running' | 'success' | 'error' | 'blocked' | 'ready' | 'retry_waiting' | 'group_retry_waiting' | 'planned' | 'canceled';
export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export interface Workflow {
  id: string;
  name: string;
  project: string;
  revision: string;
  timezone: string;
  last_session_time?: string;
  last_session_status?: WorkflowStatus;
}

export interface WorkflowListResponse {
  workflows: Workflow[];
  next_page_id?: string;
}

export interface SessionAttempt {
  id: string;
  status: WorkflowStatus;
  done: boolean;
  success: boolean;
  cancel_requested: boolean;
  created_at: string;
  finished_at?: string;
}

export interface Session {
  id: string;
  project: string;
  workflow: string;
  session_uuid: string;
  session_time: string;
  finish_time?: string;
  status: WorkflowStatus;
  params: Record<string, unknown>;
  attempt?: SessionAttempt;
}

export interface SessionListResponse {
  sessions: Session[];
  next_page_id?: string;
}

export interface Attempt {
  id: string;
  index: number;
  status: WorkflowStatus;
  state_params: Record<string, unknown>;
  done: boolean;
  success: boolean;
  cancel_requested: boolean;
  created_at: string;
  finished_at?: string;
  retry_attempt_name?: string;
}

export interface AttemptsResponse {
  attempts: Attempt[];
}

export interface TaskError {
  message: string;
  type: string;
  stack_trace?: string;
}

export interface Task {
  id: string;
  full_name: string;
  parent_id?: string;
  config: Record<string, unknown>;
  upstream_ids: string[];
  state: TaskState;
  export_params: Record<string, unknown>;
  store_params: Record<string, unknown>;
  state_params: Record<string, unknown>;
  updated_at: string;
  retry_at?: string;
  started_at?: string;
  error?: TaskError;
}

export interface TasksResponse {
  tasks: Task[];
}

export interface LogsResponse {
  logs: string;
  next_offset?: number;
  has_more: boolean;
}

export interface LogEntry {
  task: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  context: {
    attempt_id: string;
    session_id: string;
  };
}

export interface AttemptLogsResponse {
  logs: LogEntry[];
  next_offset?: number;
  has_more: boolean;
}

export interface KillAttemptResponse {
  success: boolean;
  message: string;
}

export interface RetrySessionResponse {
  attempt_id: string;
  message: string;
}

export interface RetryAttemptResponse {
  new_attempt_id: string;
  session_id: string;
  message: string;
  resumed_from?: string;
}