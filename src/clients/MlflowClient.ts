import { TraceInfo } from "../core/entities/trace_info";
import { Trace } from "../core/entities/trace";
import { TraceData } from "../core/entities/trace_data";
import { ArtifactCredentialInfo, GetCredentialsForTraceDataUploadResponse } from "../core/entities/artifact_credential_info";

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
  async createTrace(trace: Trace): Promise<TraceInfo> {
    const url = `${this.host}/api/3.0/mlflow/traces`;

    const payload = {
      trace: {
        trace_info: trace.info.toJson()
      }
    };

    const response = await this.makeRequest('POST', url, payload);
    return TraceInfo.fromJson(response.trace.trace_info);
  }

  /**
   * Upload trace data (spans) to the backend using artifact repository pattern.
   *
   * 1. Get credentials for upload
   * 2. Serialize trace data to JSON
   * 3. Upload to cloud storage using the credentials
   */
  async uploadTraceData(traceInfo: TraceInfo, traceData: TraceData): Promise<void> {
    try {
      const credentials = await this.getCredentialsForTraceDataUpload(traceInfo.traceId);
      const traceDataJson = JSON.stringify(traceData.toJson());
      await this.uploadToCloudStorage(credentials, traceDataJson);
    } catch (error) {
      console.error(`Trace data upload failed for ${traceInfo.traceId}:`, error);
      throw error;
    }
  }


  /**
   * Get credentials for uploading trace data
   * Endpoint: GET /api/2.0/mlflow/traces/{request_id}/credentials-for-data-upload
   */
  private async getCredentialsForTraceDataUpload(requestId: string): Promise<ArtifactCredentialInfo> {
    const url = `${this.host}/api/2.0/mlflow/traces/${requestId}/credentials-for-data-upload`;
    const response = await this.makeRequest('GET', url) as GetCredentialsForTraceDataUploadResponse;
    return response.credential_info;
  }

  /**
   * Upload data to cloud storage using the provided credentials
   */
  private async uploadToCloudStorage(credentials: ArtifactCredentialInfo, data: string): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add headers from credentials (if they exist)
    if (credentials.headers && Array.isArray(credentials.headers)) {
      credentials.headers.forEach(header => {
        headers[header.name] = header.value;
      });
    }

    switch (credentials.type) {
      case 'AWS_PRESIGNED_URL':
      case 'GCP_SIGNED_URL':
        await this.uploadToSignedUrl(credentials.signed_uri, data, headers, credentials.type);
        break;
      // TODO: Implement Azure upload
      case 'AZURE_SAS_URI':
      case 'AZURE_ADLS_GEN2_SAS_URI':
        throw new Error(`Azure upload not yet implemented for credential type: ${credentials.type}`);
      default:
        throw new Error(`Unsupported credential type: ${credentials.type}`);
    }
  }

  /**
   * Upload data to cloud storage using signed URL (AWS S3 or GCP Storage)
   */
  private async uploadToSignedUrl(
    signedUrl: string,
    data: string,
    headers: Record<string, string>,
    credentialType: string
  ): Promise<void> {
    try {
      const response = await fetch(signedUrl, {
        method: 'PUT',
        headers,
        body: data
      });

      if (!response.ok) {
        throw new Error(`${credentialType} upload failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Failed to upload to ${credentialType}: ${(error as Error).message}`);
    }
  }

    // === TRACE RETRIEVAL METHODS ===

  /**
   * Get a single trace by ID
   * Fetches both trace info and trace data from backend
   * Corresponds to Python: client.get_trace()
   */
  async getTrace(traceId: string): Promise<Trace> {
    const traceInfo = await this.getTraceInfo(traceId);
    const traceData = await this.downloadTraceData(traceInfo);
    return new Trace(traceInfo, traceData);
  }

  /**
   * Get trace info using V3 API
   * Endpoint: GET /api/3.0/mlflow/traces/{trace_id}
   */
  async getTraceInfo(traceId: string): Promise<TraceInfo> {
    const url = `${this.host}/api/3.0/mlflow/traces/${traceId}`;

    const response = await this.makeRequest('GET', url);

    // The V3 API returns a Trace object with trace_info field
    if (response.trace && response.trace.trace_info) {
      return TraceInfo.fromJson(response.trace.trace_info);
    }

    throw new Error('Invalid response format: missing trace_info');
  }

  /**
   * Download trace data (spans) from cloud storage
   * Uses artifact repository pattern with signed URLs
   */
  async downloadTraceData(traceInfo: TraceInfo): Promise<TraceData> {
    try {
      const credentials = await this.getCredentialsForTraceDataDownload(traceInfo.traceId);
      const traceDataJson = await this.downloadFromSignedUrl(credentials);
      return TraceData.fromJson(traceDataJson);
    } catch (error) {
      console.warn(`Failed to download trace data for ${traceInfo.traceId}:`, error);

      // Return empty trace data if download fails
      // This allows getting trace info even if data is missing
      return new TraceData([]);
    }
  }

  /**
   * Get credentials for downloading trace data
   * Endpoint: GET /mlflow/traces/{request_id}/credentials-for-data-download
   */
  private async getCredentialsForTraceDataDownload(requestId: string): Promise<ArtifactCredentialInfo> {
    const url = `${this.host}/api/2.0/mlflow/traces/${requestId}/credentials-for-data-download`;

    const response = await this.makeRequest('GET', url);

    if (response.credential_info) {
      return response.credential_info;
    } else {
      throw new Error('Invalid response format: missing credential_info');
    }
  }

  /**
   * Download data from cloud storage using signed URL
   */
  private async downloadFromSignedUrl(credentials: ArtifactCredentialInfo): Promise<any> {
    const headers: Record<string, string> = {};

    // Add headers from credentials (if they exist)
    if (credentials.headers && Array.isArray(credentials.headers)) {
      credentials.headers.forEach(header => {
        headers[header.name] = header.value;
      });
    }

    try {
      const response = await fetch(credentials.signed_uri, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Trace data not found (404)`);
        }
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const textData = await response.text();
      try {
        return JSON.parse(textData);
      } catch (parseError) {
        throw new Error(`Trace data corrupted: invalid JSON - ${(parseError as Error).message}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to download trace data: ${error}`);
    }
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
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        const errorBody = await response.json();
        if (errorBody.message) {
          errorMessage = errorBody.message;
        } else if (errorBody.error_code) {
          errorMessage = `${errorBody.error_code}: ${errorBody.message || 'Unknown error'}`;
        }
      } else {
        // Not JSON, get first 200 chars of text for debugging
        const errorText = await response.text();
        console.error(`Non-JSON error response: ${errorText.substring(0, 200)}...`);
        errorMessage = `${errorMessage} (received ${contentType || 'unknown'} instead of JSON)`;
      }
    } catch (parseError) {
      console.error(`Failed to parse error response: ${parseError}`);
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
