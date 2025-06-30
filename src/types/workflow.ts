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
  project: {
    id: string;
    name: string;
  };
  workflow: {
    id: string;
    name: string;
  };
  sessionUuid: string;
  sessionTime: string;
  lastAttempt?: {
    id: string;
    retryAttemptName: string | null;
    done: boolean;
    success: boolean;
    cancelRequested: boolean;
    params: Record<string, unknown>;
    createdAt: string;
    finishedAt: string | null;
    status: string;
    poolId: string;
  };
}

export interface SessionListResponse {
  sessions: Session[];
  next_page_id?: string;
}

export interface Attempt {
  id: string;
  index: number;
  status: WorkflowStatus;
  stateParams: Record<string, unknown>;
  done: boolean;
  success: boolean;
  cancelRequested: boolean;
  createdAt: string;
  finishedAt?: string;
  retryAttemptName?: string;
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
  fullName: string;
  parentId?: string;
  config: Record<string, unknown>;
  upstreams: string[];
  state: TaskState;
  cancelRequested?: boolean;
  exportParams: Record<string, unknown>;
  storeParams: Record<string, unknown>;
  stateParams: Record<string, unknown>;
  updatedAt: string;
  retryAt?: string;
  startedAt?: string;
  error?: TaskError;
  isGroup?: boolean;
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

export interface Project {
  id: string;
  name: string;
  revision: string;
  createdAt: string;
  updatedAt: string;
  archiveType: string;
  archiveMd5: string;
}

export interface ProjectListResponse {
  projects: Project[];
  next_page_id?: string;
}