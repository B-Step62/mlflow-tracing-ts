import { Tracer, TracerProvider } from "@opentelemetry/api";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { MlflowSpanExporter, MlflowSpanProcessor } from "../exporters/mlflow";


/* Global state that contains the tracer provider */
let tracerProvider: TracerProvider | null = null;


export function setUpTracerProvider() {
    // TODO: Implement branching logic to actually set span processor and exporter

    const exporter = new MlflowSpanExporter();
    tracerProvider = new BasicTracerProvider({
        spanProcessors: [new MlflowSpanProcessor(exporter)]
    });
}


export function getTracer(module_name: string): Tracer {
    if (!tracerProvider) {
        setUpTracerProvider();
    }

    return tracerProvider!.getTracer(module_name);
}