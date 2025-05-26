/**
 * Constants for MLflow Tracing
 */

/**
 * Enum for span types that can be used with MLflow Tracing
 */
export enum SpanType {
  UNKNOWN = 'UNKNOWN',
  LLM = 'LLM',
  CHAT_MODEL = 'CHAT_MODEL',
  EMBEDDING = 'EMBEDDING',
  AGENT = 'AGENT',
  RETRIEVER = 'RETRIEVER',
  TOOL = 'TOOL',
  CUSTOM = 'CUSTOM',
}

/**
 * Constants for MLflow span attribute keys
 */
export const SpanAttributeKey = {
  EXPERIMENT_ID: "mlflow.experimentId",
  TRACE_ID: "mlflow.traceRequestId",
  INPUTS: "mlflow.spanInputs",
  OUTPUTS: "mlflow.spanOutputs",
  SPAN_TYPE: "mlflow.spanType",
};

/**
 * Constants for MLflow trace metadata keys
 */
export const TraceMetadataKey = {
  SOURCE_RUN: "mlflow.sourceRun",
  MODEL_ID: "mlflow.modelId",
  SIZE_BYTES: "mlflow.trace.sizeBytes",
  SCHEMA_VERSION: "mlflow.traceSchemaVersion"
};

/**
 * Current version of the MLflow trace schema
 */
export const TRACE_SCHEMA_VERSION = '3';

/**
 * Trace ID for no-op spans
 */
export const NO_OP_SPAN_TRACE_ID = 'no-op-span-trace-id';
