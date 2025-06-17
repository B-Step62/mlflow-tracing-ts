import { Trace } from '../../../src/core/entities/trace';
import { TraceInfo } from '../../../src/core/entities/trace_info';
import { TraceData } from '../../../src/core/entities/trace_data';
import { TraceState } from '../../../src/core/entities/trace_state';
import { createTraceLocationFromExperimentId } from '../../../src/core/entities/trace_location';

describe('Trace', () => {
  function createMockTraceInfo(): TraceInfo {
    return new TraceInfo({
      traceId: 'tr-12345',
      traceLocation: createTraceLocationFromExperimentId('exp-123'),
      requestTime: Date.now(),
      state: TraceState.IN_PROGRESS,
      executionDuration: 1000,
      traceMetadata: { key: 'value' },
      tags: { env: 'test' },
      assessments: []
    });
  }

  function createMockTraceData(): TraceData {
    return new TraceData([]);
  }

  describe('constructor', () => {
    it('should create a Trace with info and data', () => {
      const traceInfo = createMockTraceInfo();
      const traceData = createMockTraceData();

      const trace = new Trace(traceInfo, traceData);

      expect(trace.info).toBe(traceInfo);
      expect(trace.data).toBe(traceData);
    });
  });

  describe('toJson/fromJson round-trip serialization', () => {
    it('should serialize and deserialize a complete trace correctly', () => {
      const originalTraceInfo = createMockTraceInfo();
      const originalTraceData = createMockTraceData();
      const originalTrace = new Trace(originalTraceInfo, originalTraceData);

      const json = originalTrace.toJson();

      // Verify JSON structure
      expect(json).toHaveProperty('trace_info');
      expect(json).toHaveProperty('trace_data');
      expect(json.trace_info).toMatchObject({
        trace_id: 'tr-12345',
        request_time: expect.any(String),
        state: TraceState.IN_PROGRESS
      });
      expect(json.trace_data).toMatchObject({
        spans: []
      });

      // Round-trip test
      const recreatedTrace = Trace.fromJson(json);

      expect(recreatedTrace).toBeInstanceOf(Trace);
      expect(recreatedTrace.info).toBeInstanceOf(TraceInfo);
      expect(recreatedTrace.data).toBeInstanceOf(TraceData);

      // Verify that key properties are preserved
      expect(recreatedTrace.info.traceId).toBe(originalTrace.info.traceId);
      expect(recreatedTrace.info.state).toBe(originalTrace.info.state);
      expect(recreatedTrace.data.spans).toEqual(originalTrace.data.spans);

      // Verify round-trip JSON serialization matches
      expect(recreatedTrace.toJson()).toEqual(originalTrace.toJson());
    });

    it('should handle different trace_info/trace_data field names in JSON', () => {
      const originalTrace = new Trace(createMockTraceInfo(), createMockTraceData());

      // Test with alternative field names (info/data instead of trace_info/trace_data)
      const alternativeJson = {
        info: originalTrace.info.toJson(),
        data: originalTrace.data.toJson()
      };

      const recreatedTrace = Trace.fromJson(alternativeJson);

      expect(recreatedTrace).toBeInstanceOf(Trace);
      expect(recreatedTrace.info.traceId).toBe(originalTrace.info.traceId);
      expect(recreatedTrace.data.spans).toEqual(originalTrace.data.spans);
    });

    it('should serialize trace with complex metadata and tags', () => {
      const complexTraceInfo = new TraceInfo({
        traceId: 'tr-complex',
        traceLocation: createTraceLocationFromExperimentId('exp-456'),
        requestTime: 1234567890000,
        state: TraceState.OK,
        executionDuration: 2500,
        traceMetadata: {
          model: 'gpt-4',
          version: '1.0',
          source: 'api'
        },
        tags: {
          environment: 'production',
          team: 'ai-platform',
          priority: 'high'
        },
        requestPreview: '{"prompt": "Hello"}',
        responsePreview: '{"response": "Hi there"}',
        clientRequestId: 'req-123'
      });

      const originalTrace = new Trace(complexTraceInfo, createMockTraceData());

      const json = originalTrace.toJson();
      const recreatedTrace = Trace.fromJson(json);

      // Verify complex metadata preservation
      expect(recreatedTrace.info.traceMetadata).toEqual(complexTraceInfo.traceMetadata);
      expect(recreatedTrace.info.tags).toEqual(complexTraceInfo.tags);
      expect(recreatedTrace.info.requestPreview).toBe(complexTraceInfo.requestPreview);
      expect(recreatedTrace.info.responsePreview).toBe(complexTraceInfo.responsePreview);
      expect(recreatedTrace.info.clientRequestId).toBe(complexTraceInfo.clientRequestId);

      // Verify round-trip consistency
      expect(recreatedTrace.toJson()).toEqual(originalTrace.toJson());
    });

    it('should handle traces with different states', () => {
      const states = [TraceState.IN_PROGRESS, TraceState.OK, TraceState.ERROR];

      states.forEach((state) => {
        const traceInfo = new TraceInfo({
          traceId: `tr-${state}`,
          traceLocation: createTraceLocationFromExperimentId('exp-123'),
          requestTime: Date.now(),
          state: state,
          traceMetadata: {},
          tags: {}
        });

        const originalTrace = new Trace(traceInfo, createMockTraceData());
        const json = originalTrace.toJson();
        const recreatedTrace = Trace.fromJson(json);

        expect(recreatedTrace.info.state).toBe(state);
        expect(recreatedTrace.toJson()).toEqual(originalTrace.toJson());
      });
    });
  });
});
