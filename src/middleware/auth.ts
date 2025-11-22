import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import authService from '../services/authService';
import { AuthenticatedRequest } from '../types/auth';

/**
 * Rate limiting for authentication endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Authentication middleware - validates session
 */
export const authenticateSession = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = req.headers['x-session-id'] as string || req.cookies?.sessionId;

    if (!sessionId) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No session provided'
      });
      return;
    }

    const user = await authService.validateSession(sessionId);
    if (!user) {
      res.status(401).json({
        error: 'Invalid session',
        message: 'Session expired or invalid'
      });
      return;
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      hasApiKey: !!user.openai_api_key
    };
    req.sessionId = sessionId;

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error'
    });
  }
};

/**
 * Optional authentication - doesn't block if no session
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = req.headers['x-session-id'] as string || req.cookies?.sessionId;

    if (sessionId) {
      const user = await authService.validateSession(sessionId);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          hasApiKey: !!user.openai_api_key
        };
        req.sessionId = sessionId;
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // Don't block request on error
    next();
  }
};
