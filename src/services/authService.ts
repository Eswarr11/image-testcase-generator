import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import Database from '../database/db';
import { User, Session, RegisterRequest, LoginRequest, AuthResponse } from '../types/auth';

const SALT_ROUNDS = 12;
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

export class AuthService {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await this.db.get<User>(
        'SELECT id FROM users WHERE email = ?',
        [data.email.toLowerCase()]
      );

      if (existingUser) {
        return {
          success: false,
          message: 'An account with this email already exists'
        };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

      // Create user
      const result = await this.db.run(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)',
        [data.email.toLowerCase(), passwordHash]
      );

      const userId = result.lastID as number;

      // Create session
      const sessionId = await this.createSession(userId);

      return {
        success: true,
        message: 'Account created successfully',
        user: {
          id: userId,
          email: data.email.toLowerCase(),
          hasApiKey: false
        },
        sessionId
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: 'Registration failed. Please try again.'
      };
    }
  }

  /**
   * Login user
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      // Find user
      const user = await this.db.get<User>(
        'SELECT * FROM users WHERE email = ? AND is_active = 1',
        [data.email.toLowerCase()]
      );

      if (!user) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(data.password, user.password_hash);
      if (!isValidPassword) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Update last active
      await this.updateLastActive(user.id);

      // Create session
      const sessionId = await this.createSession(user.id);

      return {
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          hasApiKey: !!user.openai_api_key
        },
        sessionId
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed. Please try again.'
      };
    }
  }

  /**
   * Logout user (destroy session)
   */
  async logout(sessionId: string): Promise<boolean> {
    try {
      await this.db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  /**
   * Validate session and return user info
   */
  async validateSession(sessionId: string): Promise<User | null> {
    try {
      const session = await this.db.get<Session>(
        'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")',
        [sessionId]
      );

      if (!session) {
        return null;
      }

      const user = await this.db.get<User>(
        'SELECT * FROM users WHERE id = ? AND is_active = 1',
        [session.user_id]
      );

      if (user) {
        // Update last active
        await this.updateLastActive(user.id);
      }

      return user || null;
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  /**
   * Update user's OpenAI API key
   */
  async updateApiKey(userId: number, apiKey: string): Promise<boolean> {
    try {
      await this.db.run(
        'UPDATE users SET openai_api_key = ? WHERE id = ?',
        [apiKey, userId]
      );
      return true;
    } catch (error) {
      console.error('API key update error:', error);
      return false;
    }
  }

  /**
   * Get user's OpenAI API key
   */
  async getApiKey(userId: number): Promise<string | null> {
    try {
      const user = await this.db.get<{ openai_api_key: string }>(
        'SELECT openai_api_key FROM users WHERE id = ?',
        [userId]
      );
      return user?.openai_api_key || null;
    } catch (error) {
      console.error('Get API key error:', error);
      return null;
    }
  }

  /**
   * Create a new session
   */
  private async createSession(userId: number): Promise<string> {
    const sessionId = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();

    await this.db.run(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
      [sessionId, userId, expiresAt]
    );

    return sessionId;
  }

  /**
   * Update user's last active timestamp
   */
  private async updateLastActive(userId: number): Promise<void> {
    await this.db.run(
      'UPDATE users SET last_active = datetime("now") WHERE id = ?',
      [userId]
    );
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await this.db.run('DELETE FROM sessions WHERE expires_at <= datetime("now")');
      return result.changes || 0;
    } catch (error) {
      console.error('Session cleanup error:', error);
      return 0;
    }
  }

  /**
   * Clean up inactive users (30+ days)
   */
  async cleanupInactiveUsers(): Promise<number> {
    try {
      const result = await this.db.run(
        'DELETE FROM users WHERE last_active <= datetime("now", "-30 days")'
      );
      console.log(`🧹 Cleaned up ${result.changes || 0} inactive users`);
      return result.changes || 0;
    } catch (error) {
      console.error('User cleanup error:', error);
      return 0;
    }
  }
}

export default new AuthService();
