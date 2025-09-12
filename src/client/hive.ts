import { Config, QueryResult as TDQueryResult } from '../types';
import { maskApiKey } from '../config';
import { getTdApiEndpointForSite } from './tdapi/endpoints';

type JobShowResponse = {
  hive_result_schema?: string | null;
  debug?: {
    cmdout?: string | null;
    stderr?: string | null;
  };
  error?: string | null;
  status?: string | null;
  query?: string | null;
  database?: string | null;
};

export interface HiveIssueJobOptions {
  priority?: number;
  retry_limit?: number;
  pool_name?: string;
}

export interface HiveJobStatus {
  job_id: string;
  status: string;
  url?: string;
  result_size?: number;
  num_records?: number;
  database?: string;
  type?: string;
  query?: string;
  start_at?: string;
  end_at?: string;
  created_at?: string;
  updated_at?: string;
  result_schema?: Array<{ name: string; type: string }>;
  error?: string;
}

/**
 * Minimal REST client for Treasure Data Hive jobs (v3 API)
 */
export class TDHiveClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  readonly database: string;

  constructor(config: Config) {
    this.apiKey = config.td_api_key;
    this.baseUrl = getTdApiEndpointForSite(config.site);
    this.database = config.database || 'sample_datasets';
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `TD1 ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        method,
        headers: this.headers(),
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        if (process.env.TD_MCP_LOG_TO_CONSOLE === 'true') {
          console.error(`[Hive] ${method} ${path} -> ${res.status}: ${text || res.statusText}`);
        }
        throw new Error(`Hive API error ${res.status}: ${text || res.statusText}`);
      }

      // Some endpoints return empty body on 204
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        return (await res.json()) as T;
      }
      return (await res.text()) as unknown as T;
    } catch (e) {
      if (e instanceof Error) {
        e.message = e.message.replace(this.apiKey, maskApiKey(this.apiKey));
      }
      throw e;
    }
  }

  private async requestWithFallback<T>(
    method: string,
    paths: string[],
    body?: unknown
  ): Promise<T> {
    let lastError: unknown;
    for (const p of paths) {
      try {
        return await this.request<T>(method, p, body);
      } catch (e) {
        lastError = e;
        const msg = e instanceof Error ? e.message : '';
        if (!/Path and method do not match any API endpoint/i.test(msg)) {
          throw e; // not a routing 404, rethrow
        }
        // otherwise try next path
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Hive API request failed');
  }

  private async requestText(method: string, path: string, body?: unknown): Promise<string> {
    const url = `${this.baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        method,
        headers: this.headers(),
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        if (process.env.TD_MCP_LOG_TO_CONSOLE === 'true') {
          console.error(`[Hive] ${method} ${path} -> ${res.status}: ${text || res.statusText}`);
        }
        throw new Error(`Hive API error ${res.status}: ${text || res.statusText}`);
      }

      return await res.text();
    } catch (e) {
      if (e instanceof Error) {
        e.message = e.message.replace(this.apiKey, maskApiKey(this.apiKey));
      }
      throw e;
    }
  }

  private parseResultText(text: string): unknown[][] {
    const trimmed = (text || '').trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && Array.isArray(parsed[0])) {
            return parsed as unknown[][];
          }
          return [parsed as unknown[]];
        }
      } catch {
        // fall through
      }
    }
    const rows: unknown[][] = [];
    for (const line of trimmed.split(/\r?\n/)) {
      const l = line.trim();
      if (!l) continue;
      try {
        const entry = JSON.parse(l);
        rows.push(Array.isArray(entry) ? entry : [entry]);
      } catch {
        rows.push([l]);
      }
    }
    return rows;
  }

  /**
   * Issues a Hive job and returns job id
   */
  async issueHive(
    query: string,
    database?: string,
    options?: HiveIssueJobOptions
  ): Promise<{ job_id: string }> {
    if (!query) throw new Error('Query is required');
    const payload: Record<string, unknown> = {
      query,
      db: database || this.database,
      priority: options?.priority,
      retry_limit: options?.retry_limit,
      pool_name: options?.pool_name,
    };
    // Try v3 endpoints first (spec: /job/issue/{job_type}/{database_name})
    const db = (database || this.database).trim();
    if (!db) throw new Error('Database name is required');
    return await this.requestWithFallback<{ job_id: string }>(
      'POST',
      [
        `/v3/job/issue/hive/${encodeURIComponent(db)}`,
        `/v3/jobs/issue/hive/${encodeURIComponent(db)}`,
      ],
      payload
    );
  }

  /**
   * Gets job status/details
   */
  async jobStatus(jobId: string): Promise<HiveJobStatus> {
    if (!jobId) throw new Error('job_id is required');
    return this.requestWithFallback<HiveJobStatus>('GET', [
      `/v3/job/status/${encodeURIComponent(jobId)}`,
      `/v3/jobs/status/${encodeURIComponent(jobId)}`,
      `/v3/jobs/${encodeURIComponent(jobId)}/status`,
    ]);
  }

  /**
   * Fetches job result as JSON rows (array of arrays)
   */
  async jobResult(jobId: string): Promise<{ rows: unknown[][] }> {
    if (!jobId) throw new Error('job_id is required');
    const text = await this.requestText(
      'GET',
      `/v3/job/result/${encodeURIComponent(jobId)}?format=json`
    );
    return { rows: this.parseResultText(text) };
  }

  /**
   * Fetches job result schema (column names/types)
   */
  async jobResultSchema(jobId: string): Promise<Array<{ name: string; type: string }>> {
    if (!jobId) throw new Error('job_id is required');
    const show = await this.request<JobShowResponse>(
      'GET',
      `/v3/job/show/${encodeURIComponent(jobId)}`
    );
    const raw = show?.hive_result_schema;
    if (typeof raw === 'string') {
      try {
        const arr = JSON.parse(raw) as Array<string[]>;
        return Array.isArray(arr)
          ? arr.map((c) => ({ name: String(c[0]), type: String(c[1]) }))
          : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /**
   * Helper that waits for job completion
   */
  async waitForCompletion(
    jobId: string,
    opts?: { pollMs?: number; timeoutMs?: number }
  ): Promise<HiveJobStatus> {
    const poll = opts?.pollMs ?? 2000;
    const timeout = opts?.timeoutMs ?? 15 * 60 * 1000; // 15m default
    const start = Date.now();
    // Typical terminal states: success, error, killed
    while (true) {
      const s = await this.jobStatus(jobId);
      if (['success', 'error', 'killed'].includes(s.status)) return s;
      if (Date.now() - start > timeout) {
        throw new Error(`Timed out waiting for job ${jobId} to complete`);
      }
      await new Promise((r) => setTimeout(r, poll));
    }
  }

  /**
   * Convenience method: run read-only query via Hive and return results
   */
  async query(sql: string, database?: string): Promise<TDQueryResult> {
    const { job_id } = await this.issueHive(sql, database);
    const status = await this.waitForCompletion(job_id);
    if (status.status !== 'success') {
      const details = await this.getJobErrorDetails(job_id);
      const message = details || status.error || '';
      throw new Error(`Hive job failed (${status.status})${message ? `: ${message}` : ''}`);
    }
    const [schema, result] = await Promise.all([
      this.jobResultSchema(job_id).catch(() => []),
      this.jobResult(job_id),
    ]);

    // Map to common TDQueryResult shape
    const columns = Array.isArray(schema)
      ? schema.map((c) => ({ name: c.name, type: c.type }))
      : [];
    const rows = result.rows || [];
    const data = rows.map((arr) => {
      const o: Record<string, unknown> = {};
      columns.forEach((c, i) => (o[c.name] = (arr as unknown[])[i]));
      return o;
    });
    return { columns, data, rowCount: data.length };
  }

  private async getJobErrorDetails(jobId: string): Promise<string | undefined> {
    try {
      const show = await this.request<JobShowResponse>(
        'GET',
        `/v3/job/show/${encodeURIComponent(jobId)}`
      );
      const parts: string[] = [];
      if (show?.error) parts.push(String(show.error));
      if (show?.debug?.stderr) parts.push(String(show.debug.stderr));
      if (show?.debug?.cmdout) parts.push(String(show.debug.cmdout));
      const text = parts.join('\n').trim();
      return text.length > 0 ? text : undefined;
    } catch {
      return undefined;
    }
  }
}
