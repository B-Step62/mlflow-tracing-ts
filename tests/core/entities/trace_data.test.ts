import { TraceData } from '../../../src/core/entities/trace_data';
import { ISpan } from '../../../src/core/entities/span';

// Mock span for testing
class MockSpan implements ISpan {
  readonly _span: any;
  readonly traceId: string;
  readonly attributes: Record<string, any>;

  constructor(data: Partial<ISpan>) {
    this._span = data._span || {};
    this.traceId = data.traceId || 'mock-trace-id';
    this.attributes = data.attributes || {};
  }

  get spanId(): string { return 'mock-span-id'; }
  get name(): string { return 'mock-span'; }
  get spanType(): any { return 'UNKNOWN'; }
  get startTimeNs(): number { return 1000000; }
  get endTimeNs(): number { return 2000000; }
  get parentId(): string | null { return null; }
  get status(): any { return { toJson: () => ({ status_code: 'OK', description: '' }) }; }
  get inputs(): any { return { input: 'test' }; }
  get outputs(): any { return { output: 'result' }; }
  get events(): any[] { return []; }

  getAttribute(key: string): any {
    return this.attributes[key];
  }

  toJson(): any {
    return {
      trace_id: this.traceId,
      span_id: this.spanId,
      name: this.name,
      span_type: this.spanType,
      start_time_ns: this.startTimeNs,
      end_time_ns: this.endTimeNs,
      status: this.status.toJson(),
      inputs: this.inputs,
      outputs: this.outputs,
      attributes: this.attributes,
      events: this.events
    };
  }
}

describe('TraceData', () => {
  describe('constructor', () => {
    it('should create empty TraceData', () => {
      const traceData = new TraceData();
      expect(traceData.spans).toEqual([]);
    });

    it('should create TraceData with spans', () => {
      const mockSpans = [
        new MockSpan({ traceId: 'tr-1' }),
        new MockSpan({ traceId: 'tr-2' })
      ];
      
      const traceData = new TraceData(mockSpans);
      expect(traceData.spans).toHaveLength(2);
      expect(traceData.spans[0].traceId).toBe('tr-1');
      expect(traceData.spans[1].traceId).toBe('tr-2');
    });
  });

  describe('toJson/fromJson round-trip serialization', () => {
    it('should serialize and deserialize empty TraceData correctly', () => {
      const originalTraceData = new TraceData();
      
      const json = originalTraceData.toJson();
      
      // Verify JSON structure
      expect(json).toEqual({
        spans: []
      });

      // Round-trip test
      const recreatedTraceData = TraceData.fromJson(json);
      
      expect(recreatedTraceData.spans).toEqual(originalTraceData.spans);
      expect(recreatedTraceData.toJson()).toEqual(originalTraceData.toJson());
    });

    it('should serialize and deserialize TraceData with spans correctly', () => {
      const mockSpans = [
        new MockSpan({ 
          traceId: 'tr-12345',
          attributes: { custom_attr: 'value1' }
        }),
        new MockSpan({ 
          traceId: 'tr-67890',
          attributes: { custom_attr: 'value2' }
        })
      ];
      
      const originalTraceData = new TraceData(mockSpans);
      
      const json = originalTraceData.toJson();
      
      // Verify JSON structure
      expect(json).toHaveProperty('spans');
      expect(json.spans).toHaveLength(2);
      expect(json.spans[0]).toMatchObject({
        trace_id: 'tr-12345',
        span_id: 'mock-span-id',
        name: 'mock-span'
      });

      // Test fromJson reconstruction
      const recreatedTraceData = TraceData.fromJson(json);
      
      expect(recreatedTraceData).toBeInstanceOf(TraceData);
      expect(recreatedTraceData.spans).toHaveLength(2);
      
      // Note: Since we can't perfectly reconstruct spans from JSON without more complex 
      // deserialization logic, we mainly test that the structure is preserved
      expect(recreatedTraceData.toJson()).toEqual(originalTraceData.toJson());
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = { invalid: 'data' };
      
      const recreatedTraceData = TraceData.fromJson(malformedJson);
      
      expect(recreatedTraceData).toBeInstanceOf(TraceData);
      expect(recreatedTraceData.spans).toEqual([]);
    });

    it('should handle JSON with null spans', () => {
      const jsonWithNullSpans = { spans: null };
      
      const recreatedTraceData = TraceData.fromJson(jsonWithNullSpans);
      
      expect(recreatedTraceData).toBeInstanceOf(TraceData);
      expect(recreatedTraceData.spans).toEqual([]);
    });
  });
});