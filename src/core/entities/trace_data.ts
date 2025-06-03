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
}
