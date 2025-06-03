

import { Trace } from '../core/entities/trace';
import { ExportResult } from '@opentelemetry/core';
import { SpanProcessor, ReadableSpan as OTelReadableSpan, SpanExporter, Span as OTelSpan } from '@opentelemetry/sdk-trace-node';
import { Context } from '@opentelemetry/api';
import { InMemoryTraceManager } from '../core/trace_manager';
import { TraceInfo } from '../core/entities/trace_info';
import { createTraceLocationFromExperimentId } from '../core/entities/trace_location';
import { fromOtelStatus, TraceState } from '../core/entities/trace_state';
import { SpanAttributeKey, TRACE_ID_PREFIX } from '../core/constants';
import { convertHrTimeToNanoSeconds, deduplicateSpanNamesInPlace } from '../core/utils';



// TODO: Remove these once we have a proper exporter.
let _traces: Trace[] = [];
export function getTraces(): Trace[] {
  return _traces;
}
export function resetTraces(): void {
  _traces = [];
}

/**
 * Generate a MLflow-compatible trace ID for the given span.
 * @param span The span to generate the trace ID for
 */
function generateTraceId(span: OTelSpan): string {
  // NB: trace Id is already hex string in Typescript OpenTelemetry SDK
  return TRACE_ID_PREFIX + span.spanContext().traceId;
}


export class MlflowSpanProcessor implements SpanProcessor {
  private _exporter: SpanExporter;

  constructor(exporter: SpanExporter) {
    this._exporter = exporter;
  }

  /**
   * Called when a {@link Span} is started, if the `span.isRecording()`
   * returns true.
   * @param span the Span that just started.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onStart(span: OTelSpan, _parentContext: Context): void {
    const otelTraceId = span.spanContext().traceId;

    let traceId: string;

    if (!span.parentSpanContext) {
      // This is a root span
      traceId = generateTraceId(span);
      const trace_info = new TraceInfo({
        traceId: traceId,
        // TODO: Set correct experiment ID once we implement an API for setting trace destination
        traceLocation: createTraceLocationFromExperimentId(null),
        requestTime: convertHrTimeToNanoSeconds(span.startTime) / 1e6,
        executionDuration: 0,
        state: TraceState.IN_PROGRESS,
        traceMetadata: {},
        tags: {},
        assessments: [],
      });
      InMemoryTraceManager.getInstance().registerTrace(otelTraceId, trace_info);
    } else {
      traceId = InMemoryTraceManager.getInstance().getMlflowTraceIdFromOtelId(otelTraceId) || '';

      if (!traceId) {
        console.warn(`No trace ID found for span ${span.name}. Skipping.`);
        return;
      }
    }

    // Set trace ID to the span
    span.setAttribute(SpanAttributeKey.TRACE_ID, JSON.stringify(traceId));
  }

  /**
   * Called when a {@link ReadableSpan} is ended, if the `span.isRecording()`
   * returns true.
   * @param span the Span that just ended.
   */
  onEnd(span: OTelReadableSpan): void {
    // Only trigger trace export for root span completion
    if (span.parentSpanContext) {
      return;
    }

    // Update trace info
    const traceId = JSON.parse(span.attributes[SpanAttributeKey.TRACE_ID] as string);
    const trace = InMemoryTraceManager.getInstance().getTrace(traceId);
    if (!trace) {
      console.warn(`No trace found for span ${span.name}. Skipping.`);
      return;
    }

    this.updateTraceInfo(trace.info, span);
    deduplicateSpanNamesInPlace(Array.from(trace.spanDict.values()));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this._exporter.export([span], (_result) => {});
  }

  /**
   * Update the trace info with the span end time and status.
   * @param trace The trace to update
   * @param span The span to update the trace with
   */
  updateTraceInfo(traceInfo: TraceInfo, span: OTelReadableSpan): void {
    const endTimeNano = convertHrTimeToNanoSeconds(span.endTime);
    traceInfo.executionDuration = (endTimeNano / 1e6) - traceInfo.requestTime;
    traceInfo.state = fromOtelStatus(span.status.code);
  }

  /**
   * Shuts down the processor. Called when SDK is shut down. This is an
   * opportunity for processor to do any cleanup required.
   */
  shutdown(): Promise<void> {
    // TODO: Implement this
    return Promise.resolve();
  }

  /**
   * Forces to export all finished spans
   */
  forceFlush(): Promise<void> {
    // TODO: Implement this
    return Promise.resolve();
  }
}


export class MlflowSpanExporter implements SpanExporter {
  export(
    spans: OTelReadableSpan[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _resultCallback: (result: ExportResult) => void
  ): void {
    for (const span of spans) {
      // Only export root spans
      if (span.parentSpanContext) {
        continue;
      }

      const trace = InMemoryTraceManager.getInstance().popTrace(span.spanContext().traceId);
      if (!trace) {
        console.warn(`No trace found for span ${span.name}. Skipping.`);
        continue;
      }

      // setLastActiveTraceId(trace.info.traceId);

      // TODO: Implement the actual export logic to MLflow backend
      _traces.push(trace);
    }
  }

  shutdown(): Promise<void> {
    // TODO: Implement this
    return Promise.resolve();
  }
}
