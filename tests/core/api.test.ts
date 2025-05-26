import { startSpan, withSpan } from '../../src/core/api';
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

    it('should create nested spans', () => {
      const parentSpan = startSpan({name: 'parent-span'});
      const childSpan1 = startSpan({name: 'child-span-1', parent: parentSpan});
      childSpan1.end();

      const childSpan2 = startSpan({name: 'child-span-2', parent: parentSpan});

      const childSpan3 = startSpan({name: 'child-span-3', parent: childSpan2});
      childSpan3.end();

      childSpan2.end();

      // This should not be a child of parentSpan
      const independentSpan = startSpan({name: 'independent-span'});
      independentSpan.end();

      parentSpan.end();

      const traces = getTraces();
      expect(traces.length).toBe(2);


      const trace1 = traces[0];
      expect(trace1.data.spans.length).toBe(1);
      expect(trace1.data.spans[0].name).toBe('independent-span');

      const trace2 = traces[1];
      expect(trace2.data.spans.length).toBe(4);
      expect(trace2.data.spans[0].name).toBe('parent-span');
      expect(trace2.data.spans[1].name).toBe('child-span-1');
      expect(trace2.data.spans[1].parentId).toBe(trace2.data.spans[0].spanId);
      expect(trace2.data.spans[2].name).toBe('child-span-2');
      expect(trace2.data.spans[2].parentId).toBe(trace2.data.spans[0].spanId);
      expect(trace2.data.spans[3].name).toBe('child-span-3');
      expect(trace2.data.spans[3].parentId).toBe(trace2.data.spans[2].spanId);
    });
  });

  describe('withSpan', () => {
    describe('inline usage pattern', () => {
      it('should execute synchronous callback and auto-set outputs', () => {
        const result = withSpan((span) => {
          span.setInputs({ a: 5, b: 3 });
          return 5 + 3;  // Auto-set outputs from return value
        });

        expect(result).toBe(8);

        const traces = getTraces();
        expect(traces.length).toBe(1);

        const loggedSpan = traces[0].data.spans[0];
        expect(loggedSpan.name).toBe('span');
        expect(loggedSpan.inputs).toEqual({ a: 5, b: 3 });
        expect(loggedSpan.outputs).toBe(8); // Auto-set from return value
        expect(loggedSpan.status?.statusCode).toBe(SpanStatusCode.OK);
      });

      it('should execute synchronous callback with explicit outputs', () => {
        const result = withSpan((span) => {
          span.setInputs({ a: 5, b: 3 });
          const sum = 5 + 3;
          span.setOutputs({ result: sum });
          return sum;
        });

        expect(result).toBe(8);

        const traces = getTraces();
        expect(traces.length).toBe(1);

        const loggedSpan = traces[0].data.spans[0];
        expect(loggedSpan.outputs).toEqual({ result: 8 }); // Explicit outputs take precedence
      });

      it('should execute asynchronous callback and auto-set outputs', async () => {
        const result = await withSpan(async (span) => {
          span.setInputs({ delay: 100 });
          await new Promise(resolve => setTimeout(resolve, 10));
          const value = 'async result';
          return value;
        });

        expect(result).toBe('async result');

        const traces = getTraces();
        expect(traces.length).toBe(1);

        const loggedSpan = traces[0].data.spans[0];
        expect(loggedSpan.inputs).toEqual({ delay: 100 });
        expect(loggedSpan.outputs).toBe('async result');
        expect(loggedSpan.status?.statusCode).toBe(SpanStatusCode.OK);
      });

      it('should handle synchronous errors', () => {
        expect(() => {
          withSpan((span) => {
            span.setInputs({ operation: 'divide by zero' });
            throw new Error('Division by zero');
          });
        }).toThrow('Division by zero');

        const traces = getTraces();
        expect(traces.length).toBe(1);

        const loggedSpan = traces[0].data.spans[0];
        expect(loggedSpan.status?.statusCode).toBe(SpanStatusCode.ERROR);
        expect(loggedSpan.status?.description).toBe('Division by zero');
      });

      it('should handle asynchronous errors', async () => {
        await expect(
          withSpan(async (span) => {
            span.setInputs({ operation: 'async error' });
            await new Promise(resolve => setTimeout(resolve, 10));
            throw new Error('Async error');
          })
        ).rejects.toThrow('Async error');

        const traces = getTraces();
        expect(traces.length).toBe(1);

        const loggedSpan = traces[0].data.spans[0];
        expect(loggedSpan.status?.statusCode).toBe(SpanStatusCode.ERROR);
        expect(loggedSpan.status?.description).toBe('Async error');
      });
    });

    describe('options-based usage pattern', () => {
      it('should execute with pre-configured options', () => {
        const result = withSpan(
          {
            name: 'add-function',
            span_type: SpanType.LLM,
            inputs: { a: 10, b: 20 },
            attributes: { model: 'test-model' }
          },
          () => { return 10 + 20; }
        );

        expect(result).toBe(30);

        const traces = getTraces();
        expect(traces.length).toBe(1);

        const loggedSpan = traces[0].data.spans[0];
        expect(loggedSpan.name).toBe('add-function');
        expect(loggedSpan.spanType).toBe(SpanType.LLM);
        expect(loggedSpan.inputs).toEqual({ a: 10, b: 20 });
        expect(loggedSpan.outputs).toEqual(30);
        expect(loggedSpan.attributes['model']).toBe('test-model');
      });

      it('should execute async with pre-configured options', async () => {
        const result = await withSpan(
          {
            name: 'async-operation',
            inputs: { data: 'test' },
            attributes: { version: '1.0' }
          },
          async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return 'processed-test';
          }
        );

        expect(result).toBe('processed-test');

        const traces = getTraces();
        expect(traces.length).toBe(1);

        const loggedSpan = traces[0].data.spans[0];
        expect(loggedSpan.name).toBe('async-operation');
        expect(loggedSpan.inputs).toEqual({ data: 'test' });
        expect(loggedSpan.outputs).toBe('processed-test');
        expect(loggedSpan.attributes['version']).toBe('1.0');
      });

      it('should handle nested spans with automatic parent-child relationship', () => {
        const result = withSpan(
          {
            name: 'parent',
            inputs: { operation: 'parent operation' }
          },
          (parentSpan) => {
            // Nested withSpan call - should automatically be a child of the parent
            const childResult = withSpan(
              {
                name: 'child',
                inputs: { nested: true }
              },
              (childSpan) => {
                childSpan.setAttributes({ nested: true });
                return 'child result';
              }
            );

            parentSpan.setOutputs({ childResult });
            return childResult;
          }
        );

        expect(result).toBe('child result');

        const traces = getTraces();
        expect(traces.length).toBe(1);
        expect(traces[0].data.spans.length).toBe(2);

        const parentSpan = traces[0].data.spans.find(s => s.name === 'parent');
        expect(parentSpan?.inputs).toEqual({ operation: 'parent operation' });
        expect(parentSpan?.outputs).toEqual({ childResult: 'child result' });

        const childSpan = traces[0].data.spans.find(s => s.name === 'child');
        expect(childSpan?.parentId).toBe(parentSpan?.spanId);
        expect(childSpan?.inputs).toEqual({ nested: true });
        expect(childSpan?.outputs).toEqual('child result');
        expect(childSpan?.attributes['nested']).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle null return values', () => {
        const result = withSpan((span) => {
          span.setInputs({ test: true });
          return null;
        });

        expect(result).toBeNull();

        const traces = getTraces();
        expect(traces.length).toBe(1);

        const loggedSpan = traces[0].data.spans[0];
        expect(loggedSpan.outputs).toBe(null); // Should auto-set null
      });

      it('should handle complex return objects', () => {
        const complexObject = {
          data: [1, 2, 3],
          metadata: { type: 'array', length: 3 }
        };

        const result = withSpan((span) => {
          span.setInputs({ operation: 'create complex object' });
          return complexObject;
        });

        expect(result).toEqual(complexObject);

        const traces = getTraces();
        expect(traces.length).toBe(1);

        const loggedSpan = traces[0].data.spans[0];
        expect(loggedSpan.outputs).toEqual(complexObject);
      });
    });
  });

  afterEach(() => {
    InMemoryTraceManager.reset();
    resetTraces();
  });
});



