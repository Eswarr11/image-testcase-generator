export interface AppErrorOptions {
  event?: string;
  fields?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly event?: string;
  public readonly fields?: Record<string, unknown>;

  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    options?: AppErrorOptions
  ) {
    super(message);
    this.name = 'AppError';
    if (options?.event) this.event = options.event;
    if (options?.fields) this.fields = options.fields;
  }
}
