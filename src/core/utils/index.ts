import { HrTime } from '@opentelemetry/api';
import { Span as OTelSpan } from '@opentelemetry/sdk-trace-node';
import { LiveSpan } from '../entities/span';
import { SpanAttributeKey } from '../constants';

/**
 * Deduplicate span names in the trace data by appending an index number to the span name.
 *
 * This is only applied when there are multiple spans with the same name. The span names
 * are modified in place to avoid unnecessary copying.
 *
 * Examples:
 *   ["red", "red"] -> ["red_1", "red_2"]
 *   ["red", "red", "blue"] -> ["red_1", "red_2", "blue"]
 *
 * @param spans A list of spans to deduplicate
 */
export function deduplicateSpanNamesInPlace(spans: LiveSpan[]): void {
  // Count occurrences of each span name
  const spanNameCounter = new Map<string, number>();

  for (const span of spans) {
    const name = span.name;
    spanNameCounter.set(name, (spanNameCounter.get(name) || 0) + 1);
  }

  // Apply renaming only for duplicated spans
  const spanNameIndexes = new Map<string, number>();
  for (const [name, count] of spanNameCounter.entries()) {
    if (count > 1) {
      spanNameIndexes.set(name, 1);
    }
  }

  // Add index to the duplicated span names
  for (const span of spans) {
    const name = span.name;
    const currentIndex = spanNameIndexes.get(name);

    if (currentIndex !== undefined) {
      // Modify the span name in place by accessing the internal OpenTelemetry span
      (span._span as any).name = `${name}_${currentIndex}`;
      spanNameIndexes.set(name, currentIndex + 1);
    }
  }
}


/**
 * OpenTelemetry Typescript SDK uses a unique timestamp format `HrTime` to represent
 * timestamps. This function converts a timestamp in nanoseconds to an `HrTime`
 * Rer: https://github.com/open-telemetry/opentelemetry-js/blob/a9fc600f2bd7dbf9345ec14e4421f1cc034f1f9c/api/src/common/Time.ts#L17-L30C13
 * @param nanoseconds The timestamp in nanoseconds
 * @returns The timestamp in `HrTime` format
 */
export function convertNanoSecondsToHrTime(nanoseconds: number): HrTime {
    return [Math.floor(nanoseconds / 1e9), nanoseconds % 1e9] as HrTime;
}

export function convertHrTimeToNanoSeconds(hrTime: HrTime): number {
    return hrTime[0] * 1e9 + hrTime[1];
}


/**
 * Extract MLflow trace ID from span attributes of an OTel span.
 *
 * @param otelSpan The OTel span
 * @returns The MLflow trace ID
 */
export function getMlflowTraceIdFromOtelSpan(otelSpan: OTelSpan): string {
    return JSON.parse(otelSpan.attributes[SpanAttributeKey.TRACE_ID] as string);
}