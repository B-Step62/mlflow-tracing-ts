import type { ISpan } from './span';
import { Span } from './span';

/**
 * Represents the spans and associated data for a trace
 */
export class TraceData {
  /**
   * The spans that make up this trace
   */
  spans: ISpan[];

  /**
   * Create a new TraceData instance
   * @param spans List of spans
   */
  constructor(spans: ISpan[] = []) {
    this.spans = spans;
  }

  /**
   * Convert this TraceData instance to JSON format
   * @returns JSON object representation of the TraceData
   */
  toJson(): any {
    return {
      spans: this.spans.map((span) => (span.toJson ? span.toJson() : span))
    };
  }

  /**
   * Create a TraceData instance from JSON data (following Python implementation)
   * @param json JSON object containing trace data
   * @returns TraceData instance
   */
  static fromJson(json: any): TraceData {
    if (!json || typeof json !== 'object') {
      throw new Error(`TraceData.fromJson() expects an object. Got: ${typeof json}`);
    }

    // Convert each span JSON to a Span object using Span.fromJson
    // This follows the exact pattern from Python: [Span.from_dict(span) for span in d.get("spans", [])]
    const spans: ISpan[] = (json.spans || []).map((spanData: any) => Span.fromJson(spanData));

    return new TraceData(spans);
  }
}
