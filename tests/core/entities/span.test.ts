import { trace } from '@opentelemetry/api';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import { createMlflowSpan, Span, NoOpSpan, LiveSpan } from '../../../src/core/entities/span';
import { SpanEvent } from '../../../src/core/entities/span_event';
import { SpanStatus, SpanStatusCode } from '../../../src/core/entities/span_status';
import { SpanAttributeKey, SpanType } from '../../../src/core/constants';

// Set up a proper tracer provider
const provider = new BasicTracerProvider();
trace.setGlobalTracerProvider(provider);

const tracer = trace.getTracer('mlflow-test-tracer', '1.0.0');

describe('Span', () => {
  describe('createMlflowSpan', () => {
    describe('Live Span Creation', () => {
      it('should create a live span from an active OpenTelemetry span', () => {
        const traceId = 'tr-12345';

        const span = tracer.startSpan('parent');

        try {
          const mlflowSpan = createMlflowSpan(span, traceId, SpanType.LLM);

          expect(mlflowSpan).toBeInstanceOf(Span);
          expect(mlflowSpan.traceId).toBe(traceId);
          expect(mlflowSpan.name).toBe('parent');
          /* OpenTelemetry's end time default value is 0 when unset */
          expect(mlflowSpan.startTimeNs).toBeGreaterThan(0);
          expect(mlflowSpan.endTimeNs).toBe(0);
          expect(mlflowSpan.parentId).toBeNull();
        } finally {
          span.end();
        }
      });

      it('should handle span inputs and outputs', () => {
        const traceId = 'tr-12345';
        const span = tracer.startSpan('test');

        try {
          const mlflowSpan = createMlflowSpan(span, traceId) as LiveSpan;

          mlflowSpan.setInputs({ input: 1 });
          mlflowSpan.setOutputs(2);

          expect(mlflowSpan.inputs).toEqual({ input: 1 });
          expect(mlflowSpan.outputs).toBe(2);
        } finally {
          span.end();
        }
      });

      it('should handle span attributes', () => {
        const traceId = 'tr-12345';
        const span = tracer.startSpan('test');

        try {
          const mlflowSpan = createMlflowSpan(span, traceId) as LiveSpan;

          mlflowSpan.setAttribute('key', 3);
          expect(mlflowSpan.getAttribute('key')).toBe(3);

          // Test complex object serialization
          const complexObject = { nested: { value: 'test' } };
          mlflowSpan.setAttribute('complex', complexObject);
          expect(mlflowSpan.getAttribute('complex')).toEqual(complexObject);
        } finally {
          span.end();
        }
      });

      it('should handle span status', () => {
        const traceId = 'tr-12345';
        const span = tracer.startSpan('test');

        try {
          const mlflowSpan = createMlflowSpan(span, traceId) as LiveSpan;

          mlflowSpan.setStatus(SpanStatusCode.OK);
          expect(mlflowSpan.status).toBeInstanceOf(SpanStatus);
          expect(mlflowSpan.status?.statusCode).toBe(SpanStatusCode.OK);
        } finally {
          span.end();
        }
      });

      it('should handle span events', () => {
        const traceId = 'tr-12345';
        const span = tracer.startSpan('test');

        try {
          const mlflowSpan = createMlflowSpan(span, traceId) as LiveSpan;

          const event = new SpanEvent({
            name: 'test_event',
            timestamp: 99999,
            attributes: { foo: 'bar' }
          });

          mlflowSpan.addEvent(event);

          const events = mlflowSpan.events;
          expect(events.length).toBeGreaterThan(0);

          // Find our test event
          const testEvent = events.find(e => e.name === 'test_event');
          expect(testEvent).toBeDefined();
          expect(testEvent?.attributes).toEqual({ foo: 'bar' });
        } finally {
          span.end();
        }
      });
    });

    describe('Completed Span Creation', () => {
      it('should create a completed span from an active OpenTelemetry span', () => {
        const traceId = 'tr-12345';
        const span = tracer.startSpan('parent');
        span.setAttribute(SpanAttributeKey.TRACE_ID, JSON.stringify(traceId));
        span.setAttribute(SpanAttributeKey.INPUTS, '{"input": 1}');
        span.setAttribute(SpanAttributeKey.OUTPUTS, '2');
        span.setAttribute('custom_attr', 'custom_value');
        span.end();

        const mlflowSpan = createMlflowSpan(span, traceId);

        expect(mlflowSpan).toBeInstanceOf(Span);
        expect(mlflowSpan.traceId).toBe(traceId);
        expect(mlflowSpan.name).toBe('parent');
        expect(mlflowSpan.startTimeNs).toBeGreaterThan(0);
        expect(mlflowSpan.endTimeNs).toBeGreaterThan(0);
        expect(mlflowSpan.parentId).toBeNull();
        expect(mlflowSpan.inputs).toEqual({ input: 1 });
        expect(mlflowSpan.outputs).toBe(2);
        expect(mlflowSpan.getAttribute('custom_attr')).toBe('custom_value');

        // Setter should not be defined for completed span
        expect('setInputs' in mlflowSpan).toBe(false);
        expect('setOutputs' in mlflowSpan).toBe(false);
        expect('setAttribute' in mlflowSpan).toBe(false);
        expect('addEvent' in mlflowSpan).toBe(false);
      });
    });

    describe('No-Op Span Creation', () => {
      it('should create a no-op span from null input', () => {
        const traceId = 'tr-12345';
        const span = createMlflowSpan(null, traceId);

        expect(span).toBeInstanceOf(NoOpSpan);
        expect(span.traceId).toBe('no-op-span-trace-id');
        expect(span.spanId).toBe('');
        expect(span.name).toBe('');
        expect(span.startTimeNs).toBe(0);
        expect(span.endTimeNs).toBeNull();
        expect(span.parentId).toBeNull();
        expect(span.inputs).toBeNull();
        expect(span.outputs).toBeNull();
      });

      it('should create a no-op span from undefined input', () => {
        const traceId = 'tr-12345';
        const span = createMlflowSpan(undefined, traceId);

        expect(span).toBeInstanceOf(NoOpSpan);
      });
    });
  });
});
