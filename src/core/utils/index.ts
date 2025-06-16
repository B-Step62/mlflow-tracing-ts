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
 * Supports both number and BigInt for large timestamps
 * Ref: https://github.com/open-telemetry/opentelemetry-js/blob/a9fc600f2bd7dbf9345ec14e4421f1cc034f1f9c/api/src/common/Time.ts#L17-L30C13
 * @param nanoseconds The timestamp in nanoseconds (number or BigInt)
 * @returns The timestamp in `HrTime` format
 */
export function convertNanoSecondsToHrTime(nanoseconds: number | bigint): HrTime {
    // Convert BigInt to number safely for HrTime (OpenTelemetry uses number arrays)
    const nanos = typeof nanoseconds === 'bigint' ? Number(nanoseconds) : nanoseconds;
    return [Math.floor(nanos / 1e9), nanos % 1e9] as HrTime;
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

/**
 * Convert a hex span ID to base64 format for JSON serialization
 * Following Python implementation: _encode_span_id_to_byte
 * @param spanId Hex string span ID (16 chars)
 * @returns Base64 encoded span ID
 */
export function encodeSpanIdToBase64(spanId: string): string {
    // Convert hex string to bytes (8 bytes for span ID)
    const bytes = new Uint8Array(8);
    
    // Parse hex string (remove any padding to 16 chars)
    const hexStr = spanId.padStart(16, '0');
    for (let i = 0; i < 8; i++) {
        bytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
    }
    
    // Convert to base64
    return Buffer.from(bytes).toString('base64');
}

/**
 * Convert a base64 span ID back to hex format
 * Following Python implementation: _decode_id_from_byte
 * @param base64SpanId Base64 encoded span ID
 * @returns Hex string span ID
 */
export function decodeSpanIdFromBase64(base64SpanId: string): string {
    // Decode from base64
    const bytes = Buffer.from(base64SpanId, 'base64');
    
    // Convert to hex string
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}