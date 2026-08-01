export interface PlatformLogger {
  trace(message: string, metadata?: Record<string, unknown>): void;
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

import logger from "../../../core/logging/logger.js";

export const ConsolePlatformLogger: PlatformLogger = {
  trace: (message, metadata) => logger.trace(message, metadata as Record<string, unknown> | undefined),
  debug: (message, metadata) => logger.debug(message, metadata as Record<string, unknown> | undefined),
  info: (message, metadata) => logger.info(message, metadata as Record<string, unknown> | undefined),
  warn: (message, metadata) => logger.warn(message, metadata as Record<string, unknown> | undefined),
  error: (message, metadata) => logger.error(message, metadata as Record<string, unknown> | undefined)
};
