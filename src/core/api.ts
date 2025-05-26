import { HrTime } from '@opentelemetry/api';
import { Span as OTelSpan } from '@opentelemetry/sdk-trace-base';
import { SpanAttributeKey, SpanType } from "./constants";
import { createMlflowSpan, ISpan, LiveSpan, NoOpSpan } from "./entities/span";
import { getTracer } from "./provider";
import { InMemoryTraceManager } from "./trace_manager";
import { convertNanoSecondsToHrTime } from './utils';



/**
 * Start a new span with the given name and span type.
 *
 * The span must be ended by calling `end` method on the returned Span object.
 *
 * @param name The name of the span.
 * @param span_type The type of the span.
 * @param inputs The inputs of the span.
 * @param attributes The attributes of the span.
 */
export function startSpan(
    options: {
        name: string,
        span_type?: SpanType,
        inputs?: any,
        attributes?: Record<string, any>,
        startTimeNs?: number
    }
): LiveSpan {
    try {
        const tracer = getTracer('default');

        const otel_span = tracer.startSpan(options.name, {
            startTime: (options.startTimeNs) ? convertNanoSecondsToHrTime(options.startTimeNs) : undefined
        }) as OTelSpan;

        const trace_id = JSON.parse(otel_span.attributes[SpanAttributeKey.TRACE_ID] as string);

        const mlflow_span = createMlflowSpan(otel_span, trace_id, options.span_type) as LiveSpan;

        if (options.inputs) {
            mlflow_span.setInputs(options.inputs);
        }

        if (options.attributes) {
            mlflow_span.setAttributes(options.attributes);
        }

        const trace_manager = InMemoryTraceManager.getInstance();
        trace_manager.registerSpan(mlflow_span);

        return mlflow_span;
    } catch (error) {
        console.warn("Failed to start span", error);
        return new NoOpSpan();
    }
}
