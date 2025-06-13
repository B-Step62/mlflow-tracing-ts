import { ISpan } from './span';

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
      spans: this.spans.map(span => span.toJson ? span.toJson() : span)
    };
  }

  /**
   * Create a TraceData instance from JSON data
   * @param json JSON object containing trace data
   * @returns TraceData instance
   */
  static fromJson(json: any): TraceData {
    // TODO: Implement proper span deserialization when ISpan has fromJson method
    return new TraceData(json.spans || []);
  }
}
