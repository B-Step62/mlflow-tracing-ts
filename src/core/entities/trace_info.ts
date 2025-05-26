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
}
