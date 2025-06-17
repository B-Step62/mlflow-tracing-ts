/**
 * HTTP header for artifact upload/download
 */
export interface HttpHeader {
  name: string;
  value: string;
}

/**
 * Type of signed credential URI
 */
export enum ArtifactCredentialType {
  AZURE_SAS_URI = 'AZURE_SAS_URI',
  AWS_PRESIGNED_URL = 'AWS_PRESIGNED_URL',
  GCP_SIGNED_URL = 'GCP_SIGNED_URL',
  AZURE_ADLS_GEN2_SAS_URI = 'AZURE_ADLS_GEN2_SAS_URI'
}

/**
 * Artifact credential information for upload/download
 */
export interface ArtifactCredentialInfo {
  /** ID of the MLflow Run containing the artifact */
  run_id?: string;

  /** Relative path to the artifact */
  path?: string;

  /** Signed URI credential for artifact access */
  signed_uri: string;

  /** HTTP headers for upload/download (optional, may not be present) */
  headers?: HttpHeader[];

  /** Type of signed credential URI */
  type: ArtifactCredentialType;
}

/**
 * Request for getting credentials for trace data upload
 */
export interface GetCredentialsForTraceDataUploadRequest {
  request_id: string;
}

/**
 * Response for getting credentials for trace data upload
 */
export interface GetCredentialsForTraceDataUploadResponse {
  credential_info: ArtifactCredentialInfo;
}
