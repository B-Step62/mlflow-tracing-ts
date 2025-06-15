import { TraceInfo } from "../core/entities/trace_info";
import { Trace } from "../core/entities/trace";
import { TraceData } from "../core/entities/trace_data";

/**
 * Databricks client for MLflow tracing operations - implements the full
 * MLflow tracing REST API for Databricks backend
 */
export class MlflowClient {
  /** Databricks workspace host URL */
  private host: string;
  /** Personal access token */
  private token?: string;

  constructor(options: { host: string; token: string }) {
    this.host = options.host;
    this.token = options.token;
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  }

  // === TRACE LIFECYCLE METHODS ===
  /**
   * Create a new TraceInfo record in the backend store.
   * Corresponding to the Python SDK's start_trace_v3() method.
   *
   * Note: the backend API is named as "Start" due to unfortunate miscommunication.
   * The API is indeed called at the "end" of a trace, not the "start".
   */
  async createTrace(trace: Trace): Promise<Trace> {
    const url = `${this.host}/api/3.0/mlflow/traces`;

    const payload = {
      trace: {
        trace_info: trace.info.toJson()
      }
    };

    const response = await this.makeRequest('POST', url, payload);
    return response as Trace;
  }

  /**
   * Upload trace data (spans) to the backend
   * TODO: This needs to be implemented once we understand how MLflow API v3 handles span data
   */
  async uploadTraceData(trace: Trace): Promise<void> {
    // TODO: Investigate the correct endpoint for uploading span data
    // The StartTraceV3 endpoint only handles trace metadata, not spans
    throw new Error('uploadTraceData not yet implemented - MLflow API v3 span upload mechanism unclear');
  }

    // === TRACE RETRIEVAL METHODS ===

  /**
   * Get a single trace by ID
   * Corresponds to Python: client.get_trace()
   */
  async getTrace(traceId: string): Promise<Trace> {
    const traceInfo = await this.getTraceInfo(traceId);
    const traceData = await this.downloadTraceData(traceInfo);
    return new Trace(traceInfo, traceData);
  }

  async getTraceInfo(traceId: string): Promise<TraceInfo> {
    const url = `${this.host}/api/3.0/mlflow/traces/${traceId}`;

    const response = await this.makeRequest('GET', url);
    return response as TraceInfo;
  }

  async downloadTraceData(traceInfo: TraceInfo): Promise<TraceData> {
    // TODO: Implement
    const data = await this.makeRequest('GET', `${this.host}/api/3.0/mlflow/traces/${traceInfo.traceId}/data`);
    return data as TraceData;
  }

  // === PRIVATE HELPER METHODS ===

  private async makeRequest(
    method: string,
    url: string,
    body?: any
  ): Promise<any> {
    try {
      console.log(`Making request to: ${url}`);
      console.log(`Method: ${method}`);
      console.log(`Body: ${body ? JSON.stringify(body) : 'None'}`);
      console.log(`Headers: ${JSON.stringify(this.getAuthHeaders())}`);

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

  // === HEALTH CHECK ===

  /**
   * Test connectivity to Databricks MLflow API
   */
  async healthCheck(experimentId: string): Promise<boolean> {
    try {
      // Use the correct Databricks API endpoint for getting an experiment
      const url = `${this.host}/api/2.0/mlflow/experiments/get?experiment_id=${experimentId}`;
      const response = await this.makeRequest('GET', url);
      return !!response.experiment;
    } catch (error) {
      console.warn('Health check failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }
}
