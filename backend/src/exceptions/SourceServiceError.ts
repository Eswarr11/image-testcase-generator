import { AppError, type AppErrorOptions } from './AppError';

export class SourceServiceError extends AppError {
  constructor(
    status: number,
    code: string,
    message: string,
    options?: AppErrorOptions
  ) {
    super(status, code, message, options);
    this.name = 'SourceServiceError';
  }
}
