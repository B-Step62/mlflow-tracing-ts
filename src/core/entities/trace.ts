import { TraceInfo } from './trace_info';
import { TraceData } from './trace_data';

/**
 * Represents a complete trace with metadata and span data
 */
export class Trace {
  /**
   * Trace metadata
   */
  info: TraceInfo;

  /**
   * Trace data containing spans
   */
  data: TraceData;

  /**
   * Create a new Trace instance
   * @param info Trace metadata
   * @param data Trace data containing spans
   */
  constructor(info: TraceInfo, data: TraceData) {
    this.info = info;
    this.data = data;
  }
}
