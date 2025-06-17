import type { LiveSpan, Span } from './entities/span';
import type { TraceInfo } from './entities/trace_info';
import { Trace } from './entities/trace';
import { TraceData } from './entities/trace_data';
import { SpanAttributeKey } from './constants';
import NodeCache from 'node-cache';

/**
 * Internal representation to keep the state of a trace.
 * Uses a Map<string, LiveSpan> instead of TraceData to allow access by span_id.
 */
class _Trace {
  info: TraceInfo;
  spanDict: Map<string, LiveSpan>;

  constructor(info: TraceInfo) {
    this.info = info;
    this.spanDict = new Map<string, LiveSpan>();
  }

  /**
   * Convert the internal trace representation to an MLflow Trace object
   */
  toMlflowTrace(): Trace {
    const traceData = new TraceData();

    // Convert LiveSpan, mutable objects, into immutable Span objects before persisting
    for (const span of this.spanDict.values()) {
      traceData.spans.push(span as Span);
    }

    const root_span = traceData.spans.find((span) => span.parentId === null);
    if (root_span) {
      // Accessing the OTel span directly get serialized value directly.
      this.info.requestPreview = (root_span._span.attributes[SpanAttributeKey.INPUTS] ||
        '') as string;
      this.info.responsePreview = (root_span._span.attributes[SpanAttributeKey.OUTPUTS] ||
        '') as string;
    }

    return new Trace(this.info, traceData);
  }
}

/**
 * Manage spans and traces created by the tracing system in memory.
 * This class is implemented as a singleton with TTL-based cleanup using NodeCache.
 * 
 * Configuration via environment variables:
 * - MLFLOW_TRACE_BUFFER_TTL_SECONDS: TTL for traces in seconds (default: 3600 = 1 hour)
 * - MLFLOW_TRACE_BUFFER_MAX_SIZE: Maximum number of traces in memory (default: 1000)
 */
export class InMemoryTraceManager {
  private static _instance: InMemoryTraceManager | null = null;

  // TTL-enabled cache to store trace_id -> _Trace mapping
  private _traces: NodeCache;
  // Store mapping between OpenTelemetry trace ID and MLflow trace ID
  private _otelIdToMlflowTraceId: Map<string, string>;

  /**
   * Singleton pattern implementation
   */
  static getInstance(): InMemoryTraceManager {
    if (InMemoryTraceManager._instance === null) {
      InMemoryTraceManager._instance = new InMemoryTraceManager();
    }
    return InMemoryTraceManager._instance;
  }

  private constructor() {
    // Read configuration from environment variables (matching Python SDK)
    const ttlSeconds = parseInt(process.env.MLFLOW_TRACE_BUFFER_TTL_SECONDS || '3600', 10);
    const maxTraces = parseInt(process.env.MLFLOW_TRACE_BUFFER_MAX_SIZE || '1000', 10);
    const checkPeriod = Math.max(60, Math.floor(ttlSeconds / 6)); // Check every ~10 minutes, min 1 minute

    // Initialize traces cache with TTL
    this._traces = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: checkPeriod,
      useClones: false, // Better performance, we control the objects
      deleteOnExpire: true,
      maxKeys: maxTraces
    });

    // Initialize OTel ID mapping as regular Map (cleaned up on popTrace)
    this._otelIdToMlflowTraceId = new Map<string, string>();

    // Clean up OTel mapping when trace expires from cache
    this._traces.on('expired', (key: string, value: _Trace) => {
      console.debug(`Trace ${key} expired from cache after ${ttlSeconds}s`);
      // Find and remove the corresponding OTel mapping
      for (const [otelId, mlflowId] of this._otelIdToMlflowTraceId.entries()) {
        if (mlflowId === key) {
          this._otelIdToMlflowTraceId.delete(otelId);
          break;
        }
      }
    });
  }

  /**
   * Register a new trace info object to the in-memory trace registry.
   * @param otelTraceId The OpenTelemetry trace ID for the new trace
   * @param traceInfo The trace info object to be stored
   */
  registerTrace(otelTraceId: string, traceInfo: TraceInfo): void {
    this._traces.set(traceInfo.traceId, new _Trace(traceInfo));
    this._otelIdToMlflowTraceId.set(otelTraceId, traceInfo.traceId);
  }

  /**
   * Store the given span in the in-memory trace data.
   * @param span The span to be stored
   */
  registerSpan(span: LiveSpan): void {
    const trace = this._traces.get(span.traceId) as _Trace | undefined;
    if (trace) {
      trace.spanDict.set(span.spanId, span);
    } else {
      console.debug(`Tried to register span ${span.spanId} for trace ${span.traceId}
                     but trace not found. Please make sure to register the trace first.`);
    }
  }

  /**
   * Get the trace for the given trace ID.
   * Returns the trace object or null if not found.
   * @param traceId The trace ID to look up
   */
  getTrace(traceId: string): _Trace | null {
    return (this._traces.get(traceId) as _Trace) || null;
  }

  /**
   * Get the MLflow trace ID for the given OpenTelemetry trace ID.
   * @param otelTraceId The OpenTelemetry trace ID
   */
  getMlflowTraceIdFromOtelId(otelTraceId: string): string | null {
    return this._otelIdToMlflowTraceId.get(otelTraceId) || null;
  }

  /**
   * Get the span for the given trace ID and span ID.
   * @param traceId The trace ID
   * @param spanId The span ID
   */
  getSpan(traceId: string, spanId: string): LiveSpan | null {
    const trace = this._traces.get(traceId) as _Trace | undefined;
    if (trace) {
      return trace.spanDict.get(spanId) || null;
    }
    return null;
  }

  /**
   * Pop trace data for the given OpenTelemetry trace ID and return it as
   * a ready-to-publish Trace object.
   * @param otelTraceId The OpenTelemetry trace ID
   */
  popTrace(otelTraceId: string): Trace | null {
    const mlflowTraceId = this._otelIdToMlflowTraceId.get(otelTraceId);
    if (!mlflowTraceId) {
      console.debug(`Tried to pop trace ${otelTraceId} but no trace found.`);
      return null;
    }

    this._otelIdToMlflowTraceId.delete(otelTraceId);
    const trace = this._traces.get(mlflowTraceId) as _Trace | undefined;
    if (trace) {
      this._traces.del(mlflowTraceId); // Use NodeCache .del() method
      return trace.toMlflowTrace();
    }
    console.debug(`Tried to pop trace ${otelTraceId} but trace not found.`);
    return null;
  }

  /**
   * Clear all the aggregated trace data. This should only be used for testing.
   */
  static reset(): void {
    if (InMemoryTraceManager._instance) {
      InMemoryTraceManager._instance._traces.flushAll(); // NodeCache method to clear all
      InMemoryTraceManager._instance._otelIdToMlflowTraceId.clear();
      InMemoryTraceManager._instance = null;
    }
  }
}
