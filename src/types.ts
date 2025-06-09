export interface Config {
  td_api_key: string;
  site: 'us01' | 'jp01' | 'eu01' | 'ap02' | 'ap03' | 'dev';
  enable_updates?: boolean;
  llm_api_base?: string;
  default_project_name?: string;
  default_agent_id?: string;
}

export interface QueryResult {
  columns: Array<{
    name: string;
    type: string;
  }>;
  data: Array<Record<string, unknown>>;
  rowCount: number;
}

export interface ExecuteResult {
  affectedRows: number;
  success: boolean;
  message?: string;
}

export type TDSite = Config['site'];

export interface TableInfo {
  database: string;
  table: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
}