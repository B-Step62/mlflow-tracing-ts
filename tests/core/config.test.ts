import { configure, getConfig, readDatabricksConfig } from '../../src/core/config';
import fs from 'fs';
import os from 'os';

// Mock fs module
jest.mock('fs');
jest.mock('os');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

describe('MLflow Tracing Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('configure', () => {
    it('should configure with databricks tracking_uri and auto-read config file', () => {
      const mockConfigContent = `
[DEFAULT]
host = https://test-workspace.databricks.com
token = test-token-123

[my-profile]
host = https://another-workspace.databricks.com
token = another-token-456
`;

      mockOs.homedir.mockReturnValue('/home/user');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockConfigContent);

      configure({
        tracking_uri: 'databricks',
        experiment_id: '12345'
      });

      const config = getConfig();
      expect(config.tracking_uri).toBe('databricks');
      expect(config.experiment_id).toBe('12345');
      expect(config.host).toBe('https://test-workspace.databricks.com');
      expect(config.token).toBe('test-token-123');
      expect(config.databricks_config_path).toBe('/home/user/.databrickscfg');
    });

    it('should configure with specific databricks profile', () => {
      const mockConfigContent = `
[DEFAULT]
host = https://test-workspace.databricks.com
token = test-token-123

[my-profile]
host = https://another-workspace.databricks.com
token = another-token-456
`;

      mockOs.homedir.mockReturnValue('/home/user');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockConfigContent);

      configure({
        tracking_uri: 'databricks://my-profile',
        experiment_id: '12345'
      });

      const config = getConfig();
      expect(config.tracking_uri).toBe('databricks://my-profile');
      expect(config.host).toBe('https://another-workspace.databricks.com');
      expect(config.token).toBe('another-token-456');
    });

    it('should use custom databricks_config_path', () => {
      const mockConfigContent = `
[DEFAULT]
host = https://custom-workspace.databricks.com
token = custom-token-789
`;

      const customPath = '/custom/path/.databrickscfg';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockConfigContent);

      configure({
        tracking_uri: 'databricks',
        experiment_id: '12345',
        databricks_config_path: customPath
      });

      const config = getConfig();
      expect(config.databricks_config_path).toBe(customPath);
      expect(config.host).toBe('https://custom-workspace.databricks.com');
      expect(config.token).toBe('custom-token-789');
    });

    it('should not override explicitly provided host and token', () => {
      const mockConfigContent = `
[DEFAULT]
host = https://config-workspace.databricks.com
token = config-token-123
`;

      mockOs.homedir.mockReturnValue('/home/user');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockConfigContent);

      configure({
        tracking_uri: 'databricks',
        experiment_id: '12345',
        host: 'https://explicit-workspace.databricks.com',
        token: 'explicit-token-456'
      });

      const config = getConfig();
      expect(config.host).toBe('https://explicit-workspace.databricks.com');
      expect(config.token).toBe('explicit-token-456');
    });

    it('should throw error if databricks config file cannot be read', () => {
      mockOs.homedir.mockReturnValue('/home/user');
      mockFs.existsSync.mockReturnValue(false);

      expect(() => {
        configure({
          tracking_uri: 'databricks',
          experiment_id: '12345'
        });
      }).toThrow(/Failed to read Databricks configuration/);
    });

    it('should throw error if profile not found in config file', () => {
      const mockConfigContent = `
[DEFAULT]
host = https://test-workspace.databricks.com
token = test-token-123
`;

      mockOs.homedir.mockReturnValue('/home/user');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockConfigContent);

      expect(() => {
        configure({
          tracking_uri: 'databricks://nonexistent-profile',
          experiment_id: '12345'
        });
      }).toThrow(/Failed to read Databricks configuration for profile 'nonexistent-profile'/);
    });

    it('should require tracking_uri', () => {
      expect(() => {
        configure({
          experiment_id: '12345'
        } as any);
      }).toThrow('tracking_uri is required in configuration');
    });

    it('should require experiment_id', () => {
      expect(() => {
        configure({
          tracking_uri: 'databricks'
        } as any);
      }).toThrow('experiment_id is required in configuration');
    });

    it('should validate tracking_uri is string', () => {
      expect(() => {
        configure({
          tracking_uri: 123,
          experiment_id: '12345'
        } as any);
      }).toThrow('tracking_uri must be a string');
    });

    it('should validate experiment_id is string', () => {
      expect(() => {
        configure({
          tracking_uri: 'databricks',
          experiment_id: 123
        } as any);
      }).toThrow('experiment_id must be a string');
    });
  });

  describe('readDatabricksConfig', () => {
    it('should read DEFAULT profile', () => {
      const mockConfigContent = `
[DEFAULT]
host = https://test-workspace.databricks.com
token = test-token-123
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockConfigContent);

      const result = readDatabricksConfig('/path/to/.databrickscfg');
      
      expect(result.host).toBe('https://test-workspace.databricks.com');
      expect(result.token).toBe('test-token-123');
    });

    it('should read specific profile', () => {
      const mockConfigContent = `
[DEFAULT]
host = https://default-workspace.databricks.com
token = default-token

[production]
host = https://prod-workspace.databricks.com
token = prod-token-456
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockConfigContent);

      const result = readDatabricksConfig('/path/to/.databrickscfg', 'production');
      
      expect(result.host).toBe('https://prod-workspace.databricks.com');
      expect(result.token).toBe('prod-token-456');
    });

    it('should throw error if config file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => {
        readDatabricksConfig('/path/to/.databrickscfg');
      }).toThrow('Databricks config file not found at /path/to/.databrickscfg');
    });

    it('should throw error if profile not found', () => {
      const mockConfigContent = `
[DEFAULT]
host = https://test-workspace.databricks.com
token = test-token-123
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockConfigContent);

      expect(() => {
        readDatabricksConfig('/path/to/.databrickscfg', 'nonexistent');
      }).toThrow("Profile 'nonexistent' not found in Databricks config file");
    });

    it('should throw error if host missing from profile', () => {
      const mockConfigContent = `
[DEFAULT]
token = test-token-123
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockConfigContent);

      expect(() => {
        readDatabricksConfig('/path/to/.databrickscfg');
      }).toThrow("Host not found for profile 'DEFAULT' in Databricks config file");
    });

    it('should throw error if token missing from profile', () => {
      const mockConfigContent = `
[DEFAULT]
host = https://test-workspace.databricks.com
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockConfigContent);

      expect(() => {
        readDatabricksConfig('/path/to/.databrickscfg');
      }).toThrow("Token not found for profile 'DEFAULT' in Databricks config file");
    });
  });

  describe('getConfig', () => {
    it('should throw error if not configured', () => {
      expect(() => {
        getConfig();
      }).toThrow(/MLflow tracing is not configured/);
    });
  });
});