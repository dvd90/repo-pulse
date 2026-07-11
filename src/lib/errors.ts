/**
 * The single error type thrown throughout RepoPulse. Handlers and services throw
 * `AppError`; a central Hono `onError` handler maps it to a consistent JSON
 * envelope. This keeps handlers free of manual status juggling.
 */
export type AppErrorCode =
  | "config_invalid"
  | "invalid_repo"
  | "validation_error"
  | "not_found"
  | "repo_not_found"
  | "upstream_rate_limited"
  | "upstream_error"
  | "upstream_timeout"
  | "internal_error";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Optional extra fields merged into the error envelope (e.g. Retry-After). */
  readonly details?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    status = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

/** Type guard for {@link AppError}. */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
