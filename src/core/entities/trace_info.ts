import { TraceLocation } from './trace_location';
import { TraceState } from './trace_state';

/**
 * Metadata about a trace, such as its ID, location, timestamp, etc.
 */
export class TraceInfo {
  /**
   * The primary identifier for the trace
   */
  traceId: string;

  /**
   * The location where the trace is stored
   */
  traceLocation: TraceLocation;

  /**
   * Start time of the trace, in milliseconds
   */
  requestTime: number;

  /**
   * State of the trace
   */
  state: TraceState;

  /**
   * Request to the model/agent (JSON-encoded, may be truncated)
   */
  requestPreview?: string;

  /**
   * Response from the model/agent (JSON-encoded, may be truncated)
   */
  responsePreview?: string;

  /**
   * Client supplied request ID associated with the trace
   */
  clientRequestId?: string;

  /**
   * Duration of the trace, in milliseconds
   */
  executionDuration?: number;

  /**
   * Key-value pairs associated with the trace (immutable)
   */
  traceMetadata: Record<string, string>;

  /**
   * Tags associated with the trace (mutable)
   */
  tags: Record<string, string>;

  /**
   * List of assessments associated with the trace.
   * TODO: Assessments are not yet supported in the TypeScript SDK.
   */
  assessments: any[];

  /**
   * Create a new TraceInfo instance
   * @param params TraceInfo parameters
   */
  constructor(params: {
    traceId: string;
    traceLocation: TraceLocation;
    requestTime: number;
    state: TraceState;
    requestPreview?: string;
    responsePreview?: string;
    clientRequestId?: string;
    executionDuration?: number;
    traceMetadata?: Record<string, string>;
    tags?: Record<string, string>;
    assessments?: any[];
  }) {
    this.traceId = params.traceId;
    this.traceLocation = params.traceLocation;
    this.requestTime = params.requestTime;
    this.state = params.state;
    this.requestPreview = params.requestPreview;
    this.responsePreview = params.responsePreview;
    this.clientRequestId = params.clientRequestId;
    this.executionDuration = params.executionDuration;
    this.traceMetadata = params.traceMetadata || {};
    this.tags = params.tags || {};
    // TODO: Assessments are not yet supported in the TypeScript SDK.
    this.assessments = [];
  }

  /**
   * Convert this TraceInfo instance to JSON format
   * @returns JSON object representation of the TraceInfo
   */
  toJson(): any {
    return {
      trace_id: this.traceId,
      client_request_id: this.clientRequestId,
      trace_location: {
        type: this.traceLocation.type,
        mlflow_experiment: this.traceLocation.mlflowExperiment ? {
          experiment_id: this.traceLocation.mlflowExperiment.experimentId
        } : undefined,
        inference_table: this.traceLocation.inferenceTable ? {
          full_table_name: this.traceLocation.inferenceTable.fullTableName
        } : undefined
      },
      request_preview: this.requestPreview,
      response_preview: this.responsePreview,
      request_time: new Date(this.requestTime).toISOString(),
      execution_duration: this.executionDuration ? `${this.executionDuration / 1000}s` : undefined,
      state: this.state,
      trace_metadata: this.traceMetadata,
      tags: this.tags,
      assessments: this.assessments
    };
  }

  /**
   * Create a TraceInfo instance from JSON data
   * @param json JSON object containing trace info data
   * @returns TraceInfo instance
   */
  static fromJson(json: any): TraceInfo {
    return new TraceInfo({
      traceId: json.trace_id,
      clientRequestId: json.client_request_id,
      traceLocation: {
        type: json.trace_location?.type,
        mlflowExperiment: json.trace_location?.mlflow_experiment ? {
          experimentId: json.trace_location.mlflow_experiment.experiment_id
        } : undefined,
        inferenceTable: json.trace_location?.inference_table ? {
          fullTableName: json.trace_location.inference_table.full_table_name
        } : undefined
      },
      requestPreview: json.request_preview,
      responsePreview: json.response_preview,
      requestTime: json.request_time ? new Date(json.request_time).getTime() : Date.now(),
      executionDuration: json.execution_duration ? parseFloat(json.execution_duration.replace('s', '')) * 1000 : undefined,
      state: json.state,
      traceMetadata: json.trace_metadata || {},
      tags: json.tags || {},
      assessments: json.assessments || []
    });
  }
}
