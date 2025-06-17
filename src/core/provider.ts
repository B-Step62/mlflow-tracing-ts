import opentelemetry from '@opentelemetry/api';
import type { Tracer } from '@opentelemetry/api';
import { MlflowSpanExporter, MlflowSpanProcessor } from '../exporters/mlflow';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { MlflowClient } from '../clients';
import { getConfig } from './config';

let sdkInitialized = false;
let sdk: NodeSDK | null = null;

function initializeSDK(): void {
  if (sdkInitialized) {
    return;
  }

  try {
    const hostConfig = getConfig();
    if (!hostConfig.host || !hostConfig.token) {
      console.warn('MLflow tracing not configured. Call configure() before using tracing APIs.');
      return;
    }

    const exporter = new MlflowSpanExporter(
      new MlflowClient({
        host: hostConfig.host,
        token: hostConfig.token
      })
    );

    const processor = new MlflowSpanProcessor(exporter);
    sdk = new NodeSDK({ spanProcessors: [processor] });
    sdk.start();
    sdkInitialized = true;
  } catch (error) {
    console.warn('Failed to initialize MLflow tracing:', error);
  }
}

export function reinitializeSDK(): void {
  if (sdk) {
    try {
      sdk.shutdown();
    } catch (error) {
      console.warn('Error shutting down existing SDK:', error);
    }
  }

  sdkInitialized = false;
  sdk = null;
  initializeSDK();
}

export function getTracer(module_name: string): Tracer {
  return opentelemetry.trace.getTracer(module_name);
}
