import path from "path";
import fs from "fs";
import os from "os";
import { parse as parseIni } from "ini";

/**
 * Configuration options for the MLflow tracing SDK
 */
export interface MLflowTracingConfig {
  /**
   * The host where traces will be logged.
   * Can be:
   * - "databricks" (uses default profile)
   * - "databricks://profile" (uses specific profile)
   * - HTTP URI for MLflow or Lens trace server backend (future)
   */
  tracking_uri: string;

  /**
   * The experiment ID where traces will be logged
   */
  experiment_id: string;

  /**
   * The location of the Databricks config file, default to ~/.databrickscfg
   */
  databricks_config_path?: string;

  /**
   * The Databricks host. If not provided, the host will be read from the Databricks config file.
   */
  host?: string;

  /**
   * The Databricks token. If not provided, the token will be read from the Databricks config file.
   */
  token?: string;
}

/**
 * Global configuration state
 */
let globalConfig: MLflowTracingConfig | null = null;

/**
 * Configure the MLflow tracing SDK with tracking location settings.
 * This must be called before using other tracing functions.
 *
 * @param config Configuration object with host and experiment_id
 *
 * @example
 * ```typescript
 * import { configure, withSpan } from 'mlflow-tracing-ts';
 *
 * // Configure the SDK first
 * configure({
 *   tracking_uri: "databricks",
 *   experiment_id: "123456789"
 * });
 *
 * // Now you can use tracing functions
 * function add(a: number, b: number) {
 *   return withSpan(
 *     { name: 'add', inputs: { a, b } },
 *     (span) => {
 *       const result = a + b;
 *       span.setOutputs({ result });
 *       return result;
 *     }
 *   );
 * }
 *
 * // Using specific Databricks profile
 * configure({
 *   tracking_uri: "databricks://my-profile",
 *   experiment_id: "123456789"
 * });
 * ```
 */
export function configure(config: MLflowTracingConfig): void {
  if (!config.tracking_uri) {
    throw new Error("tracking_uri is required in configuration");
  }

  if (!config.experiment_id) {
    throw new Error("experiment_id is required in configuration");
  }

  if (typeof config.tracking_uri !== 'string') {
    throw new Error("tracking_uri must be a string");
  }

  if (typeof config.experiment_id !== 'string') {
    throw new Error("experiment_id must be a string");
  }

  if (!config.databricks_config_path) {
    config.databricks_config_path = path.join(os.homedir(), '.databrickscfg');
  }

  if (!config.host || !config.token) {
    const profile = config.tracking_uri.startsWith('databricks://')
      ? config.tracking_uri.slice(11)
      : 'DEFAULT';

    const { host, token } = readDatabricksConfig(config.databricks_config_path, profile);
    config.host = host;
    config.token = token;
  }

  globalConfig = { ...config };
}

/**
 * Get the current configuration. Throws an error if not configured.
 * @returns The current MLflow tracing configuration
 */
export function getConfig(): MLflowTracingConfig {
  if (!globalConfig) {
    throw new Error(
      "MLflow tracing is not configured. Please call configure() with host and experiment_id before using tracing functions."
    );
  }
  return globalConfig;
}

/**
 * Read Databricks configuration from .databrickscfg file
 * @param configPath Path to the Databricks config file
 * @param profile Profile name to read (defaults to 'DEFAULT')
 * @returns Object containing host and token
 */
export function readDatabricksConfig(configPath: string, profile: string = 'DEFAULT') {
  try {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Databricks config file not found at ${configPath}`);
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = parseIni(configContent);

    if (!config[profile]) {
      throw new Error(`Profile '${profile}' not found in Databricks config file`);
    }

    const profileConfig = config[profile];

    if (!profileConfig.host) {
      throw new Error(`Host not found for profile '${profile}' in Databricks config file`);
    }

    if (!profileConfig.token) {
      throw new Error(`Token not found for profile '${profile}' in Databricks config file`);
    }

    return {
      host: profileConfig.host,
      token: profileConfig.token
    };
  } catch (error) {
    throw new Error(`Failed to read Databricks config: ${(error as Error).message}`);
  }
}
