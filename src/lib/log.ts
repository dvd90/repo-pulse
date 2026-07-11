/**
 * Minimal structured logger. Emits single-line JSON so Workers observability /
 * `wrangler tail` can index fields. Always carries the `callId` for correlation.
 */
type Level = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

function emit(level: Level, callId: string, msg: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify({ level, callId, msg, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Create a logger bound to a callId. */
export function createLogger(callId: string): Logger {
  return {
    debug: (msg, fields) => emit("debug", callId, msg, fields),
    info: (msg, fields) => emit("info", callId, msg, fields),
    warn: (msg, fields) => emit("warn", callId, msg, fields),
    error: (msg, fields) => emit("error", callId, msg, fields),
  };
}
