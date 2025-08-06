export class EnvParser {
    static getString(key: string, defaultValue?: string): string {
      const value = process.env[key];
      if (value === undefined) {
        if (defaultValue !== undefined) return defaultValue;
        throw new Error(`Environment variable ${key} is required`);
      }
      return value.trim();
    }
  
    static getNumber(key: string, defaultValue?: number): number {
      const value = process.env[key];
      if (value === undefined) {
        if (defaultValue !== undefined) return defaultValue;
        throw new Error(`Environment variable ${key} is required`);
      }
      const parsed = Number(value);
      if (isNaN(parsed)) {
        throw new Error(`Environment variable ${key} must be a valid number`);
      }
      return parsed;
    }
  
    static getBoolean(key: string, defaultValue?: boolean): boolean {
      const value = process.env[key];
      if (value === undefined) {
        if (defaultValue !== undefined) return defaultValue;
        throw new Error(`Environment variable ${key} is required`);
      }
      return value.toLowerCase() === 'true' || value === '1';
    }

    static getArray(key: string, defaultValue?: string[]): string[] {
      const value = process.env[key];
      if (value === undefined) {
        if (defaultValue !== undefined) return defaultValue;
        throw new Error(`Environment variable ${key} is required`);
      }
      return value.split(',').map(item => item.trim());
    }
  
    static getJSON<T>(key: string, defaultValue?: T): T {
      const value = process.env[key];
      if (value === undefined) {
        if (defaultValue !== undefined) return defaultValue;
        throw new Error(`Environment variable ${key} is required`);
      }
      try {
        return JSON.parse(value) as T;
      } catch (error) {
        throw new Error(`Environment variable ${key} must be valid JSON`);
      }
    }
  
    static getEnum<T extends string>(
      key: string, 
      allowedValues: readonly T[], 
      defaultValue?: T
    ): T {
      const value = process.env[key];
      if (value === undefined) {
        if (defaultValue !== undefined) return defaultValue;
        throw new Error(`Environment variable ${key} is required`);
      }
      if (!allowedValues.includes(value as T)) {
        throw new Error(
          `Environment variable ${key} must be one of: ${allowedValues.join(', ')}`
        );
      }
      return value as T;
    }
  
    static getURL(key: string, defaultValue?: string): string {
      const value = this.getString(key, defaultValue);
      try {
        new URL(value);
        return value;
      } catch {
        throw new Error(`Environment variable ${key} must be a valid URL`);
      }
    }
  
    static getPort(key: string, defaultValue?: number): number {
      const value = this.getNumber(key, defaultValue);
      if (value < 1 || value > 65535) {
        throw new Error(`Environment variable ${key} must be a valid port (1-65535)`);
      }
      return value;
    }
  }