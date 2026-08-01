export interface PlatformLogger {
  trace(message: string, metadata?: Record<string, unknown>): void;
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export const ConsolePlatformLogger: PlatformLogger = {
  trace: (message, metadata) => console.debug(message, metadata ?? {}),
  debug: (message, metadata) => console.debug(message, metadata ?? {}),
  info: (message, metadata) => console.info(message, metadata ?? {}),
  warn: (message, metadata) => console.warn(message, metadata ?? {}),
  error: (message, metadata) => console.error(message, metadata ?? {})
};
