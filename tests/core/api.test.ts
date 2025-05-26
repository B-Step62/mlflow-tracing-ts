import { startSpan } from '../../src/core/api';
import { SpanType } from '../../src/core/constants';
import { LiveSpan } from '../../src/core/entities/span';
import { SpanStatus, SpanStatusCode } from '../../src/core/entities/span_status';
import { TraceState } from '../../src/core/entities/trace_state';
import { InMemoryTraceManager } from '../../src/core/trace_manager';
import { getTraces, resetTraces } from '../../src/exporters/mlflow';



describe('API', () => {

  describe('startSpan', () => {
    it('should create a span with span type', () => {
      const span = startSpan({name: 'test-span'});
      expect(span).toBeInstanceOf(LiveSpan);

      span.setInputs({ prompt: 'Hello, world!' });
      span.setOutputs({ response: 'Hello, world!' });
      span.setAttributes({ model: 'gpt-4' });
      span.setStatus('OK');
      span.end();

      // Validate traces pushed to the in-memory buffer
      const traces = getTraces()
      expect(traces.length).toBe(1);

      const trace = traces[0];
      expect(trace.info.traceId).toBe(span.traceId);
      expect(trace.info.state).toBe(TraceState.OK);
      expect(trace.info.requestTime).toBeCloseTo(span.startTimeNs / 1000000);
      expect(trace.info.executionDuration).toBeCloseTo((span.endTimeNs! - span.startTimeNs) / 1000000);
      expect(trace.data.spans.length).toBe(1);

      const loggedSpan = trace.data.spans[0];
      expect(loggedSpan.traceId).toBe(span.traceId);
      expect(loggedSpan.name).toBe('test-span');
      expect(loggedSpan.spanType).toBe(SpanType.UNKNOWN);
      expect(loggedSpan.inputs).toEqual({ prompt: 'Hello, world!' });
      expect(loggedSpan.outputs).toEqual({ response: 'Hello, world!' });
      expect(loggedSpan.attributes['model']).toBe('gpt-4');
      expect(loggedSpan.startTimeNs).toBe(span.startTimeNs);
      expect(loggedSpan.endTimeNs).toBe(span.endTimeNs);
      expect(loggedSpan.status?.statusCode).toBe(SpanStatusCode.OK);
    });


    it('should create a span with other options', () => {
        const span = startSpan({
            name: 'test-span',
            span_type: SpanType.LLM,
            inputs: { prompt: 'Hello, world!' },
            attributes: { model: 'gpt-4' },
            startTimeNs: 1e9  // 1 second
        });
        span.end({
            outputs: { response: 'Hello, world!' },
            attributes: { model: 'gpt-4' },
            status: SpanStatusCode.ERROR,
            endTimeNs: 3e9  // 3 seconds
        });

        // Validate traces pushed to the in-memory buffer
        const traces = getTraces();
        expect(traces.length).toBe(1);

        const trace = traces[0];
        expect(trace.info.traceId).toBe(span.traceId);
        expect(trace.info.state).toBe(TraceState.ERROR);
        expect(trace.info.requestTime).toBeCloseTo(1e3); // requestTime is in milliseconds
        expect(trace.info.executionDuration).toBeCloseTo(2e3); // executionDuration is in milliseconds

        const loggedSpan = trace.data.spans[0];
        expect(loggedSpan.traceId).toBe(span.traceId);
        expect(loggedSpan.name).toBe('test-span');
        expect(loggedSpan.spanType).toBe(SpanType.LLM);
        expect(loggedSpan.inputs).toEqual({ prompt: 'Hello, world!' });
        expect(loggedSpan.outputs).toEqual({ response: 'Hello, world!' });
        expect(loggedSpan.attributes['model']).toBe('gpt-4');
        expect(loggedSpan.startTimeNs).toBe(1e9);
        expect(loggedSpan.endTimeNs).toBe(3e9);
        expect(loggedSpan.status?.statusCode).toBe(SpanStatusCode.ERROR);
    });

    it('should create a span with an exception', () => {
        const span = startSpan({name: 'test-span', span_type: SpanType.LLM});
        expect(span).toBeInstanceOf(LiveSpan);

        span.recordException(new Error('test-error'));
        span.end({status: new SpanStatus(SpanStatusCode.ERROR, 'test-error')});

        // Validate traces pushed to the in-memory buffer
        const traces = getTraces()
        expect(traces.length).toBe(1);

        const trace = traces[0];
        expect(trace.info.traceId).toBe(span.traceId);
        expect(trace.info.state).toBe(TraceState.ERROR);
        expect(trace.info.requestTime).toBeCloseTo(span.startTimeNs / 1000000);
        expect(trace.info.executionDuration).toBeCloseTo((span.endTimeNs! - span.startTimeNs) / 1000000);
        expect(trace.data.spans.length).toBe(1);

        const loggedSpan = trace.data.spans[0];
        expect(loggedSpan.status?.statusCode).toBe(SpanStatusCode.ERROR);
        expect(loggedSpan.status?.description).toBe('test-error');
      });
  });

  afterEach(() => {
    InMemoryTraceManager.reset();
    resetTraces();
  });
});



