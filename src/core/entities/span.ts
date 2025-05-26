import { NonRecordingSpan } from '@opentelemetry/api/build/src/trace/NonRecordingSpan';
import { Span as OTelSpan } from '@opentelemetry/sdk-trace-base';
import { SpanAttributeKey, SpanType, NO_OP_SPAN_TRACE_ID } from '../constants';
import { SpanEvent } from './span_event';
import { SpanStatus, SpanStatusCode } from './span_status';
import { SpanContext } from '@opentelemetry/api';
import { convertHrTimeToNanoSeconds, convertNanoSecondsToHrTime } from '../utils';
/**
 * MLflow Span interface
 */
export interface ISpan {
  /**
   * The OpenTelemetry span wrapped by MLflow Span
   */
  readonly _span: OTelSpan;

  /**
   * The trace ID
   */
  readonly traceId: string;

  /**
   * The attributes of the span
   */
  readonly attributes: Record<string, any>;

  get spanId(): string | null;
  get name(): string | null;
  get spanType(): SpanType;
  get startTimeNs(): number | null;
  get endTimeNs(): number | null;
  get parentId(): string | null;
  get status(): SpanStatus | null;
  get inputs(): any;
  get outputs(): any;

  /**
   * Get an attribute from the span
   * @param key Attribute key
   * @returns Attribute value
   */
  getAttribute(key: string ): any;

  /**
   * Get events from the span
   */
  get events(): SpanEvent[];
}

/**
 * MLflow Span class that wraps the OpenTelemetry Span.
 */
export class Span implements ISpan {
  readonly _span: OTelSpan;
  readonly _attributesRegistry: _SpanAttributesRegistry;

  /**
   * Create a new MLflowSpan
   * @param span OpenTelemetry span
   */
  constructor(span: OTelSpan, is_mutable: boolean = false) {
    this._span = span;

    if (is_mutable) {
      this._attributesRegistry = new _SpanAttributesRegistry(span);
    } else {
      this._attributesRegistry = new _CachedSpanAttributesRegistry(span);
    }
  }

  get traceId(): string {
    return this.getAttribute(SpanAttributeKey.TRACE_ID);
  }

  get spanId(): string {
    return this._span.spanContext().spanId;
  }

  get spanType(): SpanType {
    return this.getAttribute(SpanAttributeKey.SPAN_TYPE);
  }

  /**
   * Get the parent span ID
   */
  get parentId(): string | null {
    if ('parentSpanContext' in this._span) {
      return (this._span.parentSpanContext as SpanContext).spanId;
    }
    return null;
  }

  get name(): string {
    return this._span.name;
  }

  get startTimeNs(): number {
    return convertHrTimeToNanoSeconds(this._span.startTime);
  }

  get endTimeNs(): number | null {
    return convertHrTimeToNanoSeconds(this._span.endTime);
  }

  get status(): SpanStatus {
    return SpanStatus.fromOtelStatus(this._span.status);
  }

  get inputs(): any {
    return this.getAttribute(SpanAttributeKey.INPUTS);
  }

  get outputs(): any {
    return this.getAttribute(SpanAttributeKey.OUTPUTS);
  }

  get attributes(): Record<string, any> {
    return this._attributesRegistry.getAll();
  }

  getAttribute(key: string): any {
    return this._attributesRegistry.get(key);
  }

  get events(): SpanEvent[] {
    return this._span.events.map((event) => {
      const [seconds, nanoseconds] = event.time;
      return new SpanEvent({
        name: event.name,
        attributes: event.attributes as Record<string, any>,
        timestamp: seconds * 1_000_000_000 + nanoseconds,
      });
    });
  }
}


export class LiveSpan extends Span {
  constructor(span: OTelSpan, traceId: string, span_type: SpanType) {
    super(span, true);
    this.setAttribute(SpanAttributeKey.TRACE_ID, traceId);
    this.setAttribute(SpanAttributeKey.SPAN_TYPE, span_type);
  }


  /**
   * Set inputs for the span
   * @param inputs Input data for the span
   */
  setInputs(inputs: any): void {
    if (inputs === undefined || inputs === null) return;
    this._attributesRegistry.set(SpanAttributeKey.INPUTS, inputs);
  }

  /**
   * Set outputs for the span
   * @param outputs Output data for the span
   */
  setOutputs(outputs: any): void {
    if (outputs === undefined || outputs === null) return;
    this._attributesRegistry.set(SpanAttributeKey.OUTPUTS, outputs);
  }

  /**
   * Set an attribute on the span
   * @param key Attribute key
   * @param value Attribute value
   */
  setAttribute(key: string, value: any): void {
    this._attributesRegistry.set(key, value);
  }

  /**
   * Set multiple attributes on the span
   * @param attributes Object containing key-value pairs for attributes
   */
  setAttributes(attributes: Record<string, any>): void {
    if (!attributes) return;

    Object.entries(attributes).forEach(([key, value]) => {
      this.setAttribute(key, value);
    });
  }

  /**
   * Add an event to the span
   * @param event Event object with name and attributes
   */
  addEvent(event: SpanEvent): void {
    this._span.addEvent(event.name, event.attributes, event.timestamp);
  }

  /**
   * Record an exception event to the span
   * @param error Error object
   */
  recordException(error: Error): void {
    this._span.recordException(error);
  }

  /**
   * Set the status of the span
   * @param status Status code or SpanStatus object
   * @param description Optional description for the status
   */
  setStatus(status: SpanStatus | SpanStatusCode | string, description?: string): void {
    if (status instanceof SpanStatus) {
      this._span.setStatus(status.toOtelStatus());
    } else if (typeof status === 'string') {
      const spanStatus = new SpanStatus(status, description);
      this._span.setStatus(spanStatus.toOtelStatus());
    } else {
      throw new Error(`${status} is not a valid SpanStatusCode value`);
    }
  }

  /**
   * End the span
   *
   * @param outputs Optional outputs to set before ending
   * @param attributes Optional attributes to set before ending
   * @param status Optional status code
   * @param endTimeNs Optional end time in nanoseconds
   */
  end(
    options?: {
      outputs?: any,
      attributes?: Record<string, any>,
      status?: SpanStatus | SpanStatusCode,
      endTimeNs?: number
    }
  ): void {
    if (options?.outputs !== undefined) {
      this.setOutputs(options.outputs);
    }

    if (options?.attributes !== undefined) {
      this.setAttributes(options.attributes);
    }

    if (options?.status !== undefined) {
      this.setStatus(options.status);
    }

    // NB: In OpenTelemetry, status code remains UNSET if not explicitly set
    // by the user. However, there is not way to set the status when using
    // `trace` function wrapper. Therefore, we just automatically set the status
    // to OK if it is not ERROR.
    if (this.status.statusCode !== SpanStatusCode.ERROR) {
      this.setStatus(SpanStatusCode.OK);
    }

    const endTime = (options?.endTimeNs) ? convertNanoSecondsToHrTime(options.endTimeNs) : undefined;
    this._span.end(endTime);
  }
}

/**
 * A no-operation span implementation that doesn't record anything
 */
export class NoOpSpan implements LiveSpan {
  readonly _span: any; // Use any for NoOp span to avoid type conflicts
  readonly _attributesRegistry: _SpanAttributesRegistry;

  constructor(span?: NonRecordingSpan) {
    // Create a minimal no-op span object
    this._span = span || new NonRecordingSpan();
    this._attributesRegistry = new _SpanAttributesRegistry(this._span);
  }

  get traceId(): string { return NO_OP_SPAN_TRACE_ID; }
  get spanId(): string { return ''; }
  get parentId(): string | null { return null; }
  get name(): string { return ''; }
  get spanType(): SpanType { return SpanType.UNKNOWN; }
  get startTimeNs(): number { return 0; }
  get endTimeNs(): number | null { return null; }
  get status(): SpanStatus { return new SpanStatus(SpanStatusCode.UNSET); }
  get inputs(): any { return null; }
  get outputs(): any { return null; }
  get attributes(): Record<string, any> { return {}; }

  getAttribute(key: string): any { return null; }

  // Implement all methods to do nothing
  setInputs(_inputs: any): void {}
  setOutputs(_outputs: any): void {}
  setAttribute(_key: string, _value: any): void {}
  setAttributes(_attributes: Record<string, any>): void {}
  setStatus(_status: SpanStatus | SpanStatusCode | string, _description?: string): void {}
  addEvent(_event: SpanEvent): void {}
  recordException(_error: Error): void {}
  end(_outputs?: any, _attributes?: Record<string, any>, _status?: SpanStatus | SpanStatusCode, _endTimeNs?: number): void {}

  get events(): SpanEvent[] {
    return [];
  }
}



/**
 * A utility class to manage the span attributes.
 * In MLflow users can add arbitrary key-value pairs to the span attributes, however,
 * OpenTelemetry only allows a limited set of types to be stored in the attribute values.
 * Therefore, we serialize all values into JSON string before storing them in the span.
 * This class provides simple getter and setter methods to interact with the span attributes
 * without worrying about the serde process.
 */
class _SpanAttributesRegistry {
  private readonly _span: OTelSpan;

  constructor(otelSpan: OTelSpan) {
    this._span = otelSpan;
  }

  /**
   * Get all attributes as a dictionary
   */
  getAll(): Record<string, any> {
    const result: Record<string, any> = {};
    if (this._span.attributes) {
      Object.keys(this._span.attributes).forEach(key => {
        result[key] = this.get(key);
      });
    }
    return result;
  }

  /**
   * Get a single attribute value
   */
  get(key: string): any {
    const serializedValue = this._span.attributes?.[key];
    if (serializedValue && typeof serializedValue === 'string') {
      try {
        return JSON.parse(serializedValue);
      } catch (e) {
        console.warn(
          `Failed to get value for key ${key}, make sure you set the attribute ` +
          `on mlflow Span class instead of directly to the OpenTelemetry span. ${e}`
        );
        return serializedValue;
      }
    }
    return serializedValue;
  }

  /**
   * Set a single attribute value
   */
  set(key: string, value: any): void {
    if (typeof key !== 'string') {
      console.warn(`Attribute key must be a string, but got ${typeof key}. Skipping.`);
      return;
    }

    // NB: OpenTelemetry attribute can store not only string but also a few primitives like
    // int, float, bool, and list of them. However, we serialize all into JSON string here
    // for the simplicity in deserialization process.
    this._span.setAttribute(key, JSON.stringify(value));
  }
}

/**
 * A cache-enabled version of the SpanAttributesRegistry.
 * The caching helps to avoid the redundant deserialization of the attribute, however, it does
 * not handle the value change well. Therefore, this class should only be used for the persisted
 * spans that are immutable, and thus implemented as a subclass of _SpanAttributesRegistry.
 */
class _CachedSpanAttributesRegistry extends _SpanAttributesRegistry {
  private readonly _cache = new Map<string, any>();

  /**
   * Get a single attribute value with caching
   */
  get(key: string): any {
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }

    const value = super.get(key);
    this._cache.set(key, value);
    return value;
  }

  /**
   * Set operation is not allowed for cached registry (immutable spans)
   */
  set(key: string, value: any): void {
    throw new Error('The attributes of the immutable span must not be updated.');
  }
}

/**
 * Factory function to create a span object.
 */
export function createMlflowSpan(
  otelSpan: any,
  traceId: string,
  spanType?: string
): ISpan {
  if (!otelSpan || otelSpan instanceof NonRecordingSpan) {
    return new NoOpSpan(otelSpan);
  }

  // If the span is completed, it should be immutable.
  if (otelSpan.ended) {
    return new Span(otelSpan);
  }

  if (otelSpan instanceof OTelSpan) {
    return new LiveSpan(otelSpan, traceId, spanType as SpanType || SpanType.UNKNOWN);
  }


  throw new Error(
    `The \`otelSpan\` argument must be an instance of one of valid ` +
    `OpenTelemetry span classes, but got ${typeof otelSpan}.`
  );
}
