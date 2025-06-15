import opentelemetry from "@opentelemetry/api";
import { Tracer } from "@opentelemetry/api";
import { MlflowSpanExporter, MlflowSpanProcessor } from "../exporters/mlflow";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { MlflowClient } from "../clients";
import { configure, getConfig } from "./config";


// TODO: Implement branching logic to actually set span processor and exporter

configure({
    tracking_uri: process.env.MLFLOW_TRACKING_URI!,
    experiment_id: process.env.MLFLOW_EXPERIMENT_ID!,
    databricks_config_path: process.env.DATABRICKS_CONFIG_PATH,
});

const hostConfig = getConfig();
const exporter = new MlflowSpanExporter(new MlflowClient({
    host: hostConfig.host!,
    token: hostConfig.token!
}));

const processor = new MlflowSpanProcessor(exporter);
const sdk = new NodeSDK({spanProcessors: [processor]});
sdk.start();


export function getTracer(module_name: string): Tracer {
    return opentelemetry.trace.getTracer(module_name);
}