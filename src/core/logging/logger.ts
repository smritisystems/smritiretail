export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "silent";

const levelPriority: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  silent: 100,
};

function getEnvLogLevel(): LogLevel {
  const envSource = typeof process !== "undefined" && typeof process.env !== "undefined" ? process.env : undefined;
  const env = (envSource?.LOG_LEVEL || envSource?.NODE_ENV || "").toLowerCase();
  if (env === "trace") return "trace";
  if (env === "debug") return "debug";
  if (env === "warn") return "warn";
  if (env === "error") return "error";
  if (env === "silent") return "silent";
  return env === "production" ? "info" : "debug";
}

const currentLevel = getEnvLogLevel();
const consoleImpl = typeof console !== "undefined" ? console : { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as Console;

function shouldLog(level: LogLevel) {
  return levelPriority[level] >= levelPriority[currentLevel];
}

export const logger = {
  trace: (msg: string, meta?: unknown) => {
    if (shouldLog("trace")) consoleImpl.debug?.(msg, meta ?? {});
  },
  debug: (msg: string, meta?: unknown) => {
    if (shouldLog("debug")) consoleImpl.debug?.(msg, meta ?? {});
  },
  info: (msg: string, meta?: unknown) => {
    if (shouldLog("info")) consoleImpl.info?.(msg, meta ?? {});
  },
  warn: (msg: string, meta?: unknown) => {
    if (shouldLog("warn")) consoleImpl.warn?.(msg, meta ?? {});
  },
  error: (msg: string, meta?: unknown) => {
    if (shouldLog("error")) consoleImpl.error?.(msg, meta ?? {});
  }
};

export default logger;
