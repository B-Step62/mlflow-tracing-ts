import { getConfig } from "../core/config";
import { TraceInfo } from "../core/entities/trace_info";
import { Trace } from "../core/entities/trace";
import { TraceData } from "../core/entities/trace_data";

/**
 * Response interfaces matching MLflow API schemas
 */
export interface StartTraceResponse {
  trace: {
    trace_info: any;
  };
}

export interface GetTraceResponse {
  trace: {
    info: any;
    data: any;
  };
}

export interface SearchTracesResponse {
  traces: Array<{
    info: any;
    data: any;
  }>;
  next_page_token?: string;
}

export interface EndTraceResponse {
  trace: {
    trace_info: any;
  };
}

/**
 * Search options for trace queries
 */
export interface SearchTracesOptions {
  experimentIds?: string[];
  filter?: string;
  maxResults?: number;
  orderBy?: string[];
  pageToken?: string;
}

/**
 * Databricks client for MLflow tracing operations - implements the full
 * MLflow tracing REST API for Databricks backend
 */
export class DatabricksClient {
  private host: string;
  private experimentId: string;
  private token: string;

  constructor(host: string, experimentId: string, token?: string) {
    this.host = host;
    this.experimentId = experimentId;
    this.token = token || getConfig().token!;
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  }

  // === TRACE LIFECYCLE METHODS ===

  /**
   * Start a new trace (creates TraceInfo)
   * Corresponds to Python: client.start_trace()
   */
  async startTrace(traceInfo: TraceInfo): Promise<StartTraceResponse> {
    const url = `${this.host}/api/2.0/mlflow/traces`;
    
    const payload = {
      trace: {
        trace_info: traceInfo.toJson()
      }
    };

    const response = await this.makeRequest('POST', url, payload);
    return response as StartTraceResponse;
  }

  /**
   * End a trace and upload all trace data (TraceInfo + all spans)
   * Corresponds to Python: client.end_trace()
   */
  async endTrace(trace: Trace): Promise<EndTraceResponse> {
    const url = `${this.host}/api/2.0/mlflow/traces/${trace.info.traceId}`;
    
    const payload = {
      trace: {
        trace_info: trace.info.toJson(),
        trace_data: trace.data.toJson()
      }
    };

    const response = await this.makeRequest('PUT', url, payload);
    return response as EndTraceResponse;
  }

  /**
   * Legacy method - use startTrace instead
   * @deprecated Use startTrace method
   */
  async createTraceInfoV3(traceInfo: TraceInfo): Promise<StartTraceResponse> {
    return this.startTrace(traceInfo);
  }

  // === TRACE RETRIEVAL METHODS ===

  /**
   * Get a single trace by ID
   * Corresponds to Python: client.get_trace()
   */
  async getTrace(traceId: string): Promise<Trace> {
    const url = `${this.host}/api/2.0/mlflow/traces/${traceId}`;
    
    const response = await this.makeRequest('GET', url) as GetTraceResponse;
    
    // Convert API response back to Trace object
    return this.responseToTrace(response.trace);
  }

  /**
   * Search traces with optional filtering
   * Corresponds to Python: client.search_traces()
   */
  async searchTraces(options: SearchTracesOptions = {}): Promise<{traces: Trace[], nextPageToken?: string}> {
    const url = `${this.host}/api/2.0/mlflow/traces/search`;
    
    const payload = {
      experiment_ids: options.experimentIds || [this.experimentId],
      filter: options.filter,
      max_results: options.maxResults || 100,
      order_by: options.orderBy,
      page_token: options.pageToken
    };

    const response = await this.makeRequest('POST', url, payload) as SearchTracesResponse;
    
    return {
      traces: response.traces.map(t => this.responseToTrace(t)),
      nextPageToken: response.next_page_token
    };
  }

  // === TRACE TAG MANAGEMENT ===

  /**
   * Set a tag on a trace
   * Corresponds to Python: client.set_trace_tag()
   */
  async setTraceTag(traceId: string, key: string, value: string): Promise<void> {
    const url = `${this.host}/api/2.0/mlflow/traces/${traceId}/tags`;
    
    const payload = {
      key,
      value
    };

    await this.makeRequest('POST', url, payload);
  }

  /**
   * Delete a tag from a trace
   * Corresponds to Python: client.delete_trace_tag()
   */
  async deleteTraceTag(traceId: string, key: string): Promise<void> {
    const url = `${this.host}/api/2.0/mlflow/traces/${traceId}/tags/${key}`;
    
    await this.makeRequest('DELETE', url);
  }

  // === BATCH OPERATIONS ===

  /**
   * Upload multiple traces in batch
   * Useful for bulk operations
   */
  async uploadTraces(traces: Trace[]): Promise<void> {
    const url = `${this.host}/api/2.0/mlflow/traces/batch`;
    
    const payload = {
      traces: traces.map(trace => ({
        trace_info: trace.info.toJson(),
        trace_data: trace.data.toJson()
      }))
    };

    await this.makeRequest('POST', url, payload);
  }

  /**
   * Legacy method - use endTrace instead
   * @deprecated Use endTrace method
   */
  async uploadTraceData(trace: Trace): Promise<EndTraceResponse> {
    return this.endTrace(trace);
  }

  // === PRIVATE HELPER METHODS ===

  private async makeRequest(
    method: string, 
    url: string, 
    body?: any
  ): Promise<any> {
    try {
      const response = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: body ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      // Handle empty responses (like DELETE operations)
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return {};
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Databricks API request failed: ${(error as Error).message}`);
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorBody = await response.json();
      if (errorBody.message) {
        errorMessage = errorBody.message;
      } else if (errorBody.error_code) {
        errorMessage = `${errorBody.error_code}: ${errorBody.message || 'Unknown error'}`;
      }
    } catch {
      // If we can't parse the error body, use the basic message
    }

    throw new Error(errorMessage);
  }

  private responseToTrace(traceResponse: any): Trace {
    // Convert API response format back to internal Trace object
    const traceInfo = TraceInfo.fromJson(traceResponse.info);
    const traceData = TraceData.fromJson(traceResponse.data);
    
    return new Trace(traceInfo, traceData);
  }

  // === HEALTH CHECK ===

  /**
   * Test connectivity to Databricks MLflow API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.host}/api/2.0/mlflow/experiments/get?experiment_id=${this.experimentId}`;
      const response = await this.makeRequest('GET', url);
      return !!response.experiment;
    } catch {
      return false;
    }
  }
}
