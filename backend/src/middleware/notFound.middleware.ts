import { Request, Response } from 'express';

export function apiNotFound(req: Request, res: Response): void {
  res.status(404).json({
    error: 'API endpoint not found',
    message: `The endpoint ${req.method} ${req.path} was not found`,
    path: req.path,
  });
}
