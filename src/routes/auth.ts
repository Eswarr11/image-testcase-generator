import { Router, Request, Response } from 'express';
import Joi from 'joi';
import authService from '../services/authService';
import { authenticateSession, authRateLimit } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';

const router = Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    'any.required': 'Password is required'
  })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const apiKeySchema = Joi.object({
  apiKey: Joi.string().pattern(/^sk-/).required().messages({
    'string.pattern.base': 'Invalid API key format. OpenAI API keys start with "sk-"',
    'any.required': 'API key is required'
  })
});

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', authRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.details[0]?.message || 'Validation failed'
      });
    }

    const result = await authService.register(value);
    
    if (result.success && result.sessionId) {
      // Set session cookie
      res.cookie('sessionId', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }

    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    console.error('Register endpoint error:', error);
    return res.status(500).json({
      error: 'Registration failed',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', authRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.details[0]?.message || 'Validation failed'
      });
    }

    const result = await authService.login(value);
    
    if (result.success && result.sessionId) {
      // Set session cookie
      res.cookie('sessionId', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }

    return res.status(result.success ? 200 : 401).json(result);
  } catch (error) {
    console.error('Login endpoint error:', error);
    return res.status(500).json({
      error: 'Login failed',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (destroy session)
 */
router.post('/logout', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.sessionId) {
      await authService.logout(req.sessionId);
    }
    
    // Clear session cookie
    res.clearCookie('sessionId');
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout endpoint error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    user: req.user
  });
});

/**
 * PUT /api/auth/api-key
 * Update user's OpenAI API key
 */
router.put('/api-key', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate request body
    const { error, value } = apiKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.details[0]?.message || 'Validation failed'
      });
    }

    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    const success = await authService.updateApiKey(req.user.id, value.apiKey);
    
    if (success) {
      return res.json({
        success: true,
        message: 'API key updated successfully'
      });
    } else {
      return res.status(500).json({
        error: 'Update failed',
        message: 'Failed to update API key'
      });
    }
  } catch (error) {
    console.error('API key update endpoint error:', error);
    return res.status(500).json({
      error: 'Update failed',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/auth/api-key
 * Get user's OpenAI API key
 */
router.get('/api-key', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    const apiKey = await authService.getApiKey(req.user.id);
    
    return res.json({
      success: true,
      hasApiKey: !!apiKey,
      apiKey: apiKey || undefined
    });
  } catch (error) {
    console.error('Get API key endpoint error:', error);
    return res.status(500).json({
      error: 'Failed to get API key',
      message: 'Internal server error'
    });
  }
});

export default router;
