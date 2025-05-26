import { SpanStatusCode as OTelSpanStatusCode } from '@opentelemetry/api';
import { SpanStatus, SpanStatusCode } from '../../../src/core/entities/span_status';

describe('SpanStatus', () => {
  describe('initialization', () => {
    // Test both enum and string initialization (parameterized test equivalent)
    const testCases = [
      { input: "OK", expected: SpanStatusCode.OK },
      { input: "ERROR", expected: SpanStatusCode.ERROR },
      { input: "UNSET", expected: SpanStatusCode.UNSET },
    ];

    testCases.forEach(({ input, expected }) => {
      it(`should initialize with status code ${input}`, () => {
        const spanStatus = new SpanStatus(input, 'test');
        expect(spanStatus.statusCode).toBe(expected);
        expect(spanStatus.description).toBe('test');
      });
    });
  });

  describe('OpenTelemetry status conversion', () => {
    const conversionTestCases = [
      {
        mlflowStatus: SpanStatusCode.OK,
        otelStatus: OTelSpanStatusCode.OK,
      },
      {
        mlflowStatus: SpanStatusCode.ERROR,
        otelStatus: OTelSpanStatusCode.ERROR,
      },
      {
        mlflowStatus: SpanStatusCode.UNSET,
        otelStatus: OTelSpanStatusCode.UNSET,
      },
    ];

    conversionTestCases.forEach(({ mlflowStatus, otelStatus }) => {
      it(`should convert ${mlflowStatus} to OpenTelemetry status correctly`, () => {
        const spanStatus = new SpanStatus(mlflowStatus);
        const otelStatusResult = spanStatus.toOtelStatus();

        expect(otelStatusResult.code).toBe(otelStatus);
      });
    });
  });
});