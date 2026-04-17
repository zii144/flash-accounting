export class AppError extends Error {
  code: string;

  constructor(code: string, message?: string, options?: { cause?: unknown }) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;

    if (options && "cause" in options) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function getAppErrorCode(error: unknown): string | null {
  if (error instanceof AppError) {
    return error.code;
  }

  return null;
}

export function isAppErrorCode(error: unknown, code: string): boolean {
  return getAppErrorCode(error) === code;
}

