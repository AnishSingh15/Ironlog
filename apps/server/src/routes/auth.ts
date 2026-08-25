import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const profileUpdateSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

// In-memory reset token store: { hashedToken -> { userId, expiresAt } }. A password
// reset is infrequent and low-stakes enough that a persisted table isn't warranted yet;
// tokens simply stop working if the process restarts, which just means requesting a new one.
const resetTokens = new Map<string, { userId: string; expiresAt: number }>();
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

const hashResetToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

// Helper functions
const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, config.jwtRefreshSecret, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
  // Production serves the frontend and backend from different domains (Vercel + Render) -
  // that's cross-site, and SameSite=Strict (or Lax) cookies are never sent on a cross-site
  // fetch/XHR no matter what the client's `credentials` option is set to. Only SameSite=None
  // (which requires Secure) works there. Locally, both run on http://localhost, so Lax is fine
  // and doesn't require HTTPS.
  const isProduction = config.nodeEnv === 'production';
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// POST /api/v1/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        error: { message: 'User already exists' },
      });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Set refresh token cookie
    setRefreshTokenCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
        },
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({
        success: false,
        error: {
          message: 'Invalid input data',
          details: (error as unknown as { errors: unknown }).errors,
        },
      });
      return;
    }

    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' },
    });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: { message: 'Invalid credentials' },
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: { message: 'Invalid credentials' },
      });
      return;
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Set refresh token cookie
    setRefreshTokenCookie(res, refreshToken);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
        },
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({
        success: false,
        error: {
          message: 'Invalid input data',
          details: (error as unknown as { errors: unknown }).errors,
        },
      });
      return;
    }

    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' },
    });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        error: { message: 'Refresh token not found' },
      });
      return;
    }

    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as { userId: string };
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);

    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      success: true,
      data: { accessToken },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: { message: 'Invalid refresh token' },
    });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('refreshToken');
  res.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
});

// GET /api/v1/auth/profile
router.get('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'User not authenticated' },
      });
      return;
    }

    // Get user profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' },
    });
  }
});

// PUT /api/v1/auth/profile
router.put('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { name, email } = profileUpdateSchema.parse(req.body);

    const existing = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
    if (existing) {
      res.status(400).json({ success: false, error: { message: 'Email is already in use' } });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name, email },
      select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
    });

    res.json({ success: true, data: { user } });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({ success: false, error: { message: 'Invalid input data' } });
      return;
    }
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
});

// PUT /api/v1/auth/password
router.put('/password', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'User not found' } });
      return;
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      res.status(401).json({ success: false, error: { message: 'Current password is incorrect' } });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    res.json({ success: true, data: { message: 'Password changed successfully' } });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({ success: false, error: { message: 'Invalid input data' } });
      return;
    }
    console.error('Password change error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond success regardless of whether the email exists, so this endpoint
    // can't be used to enumerate registered accounts.
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      resetTokens.set(hashResetToken(token), {
        userId: user.id,
        expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
      });

      // No email provider is configured yet - log the reset link instead of sending it.
      // eslint-disable-next-line no-console
      console.log(
        `[password reset] ${email}: ${config.nodeEnv === 'production' ? '(link omitted from logs in production - email delivery not yet configured)' : `/reset-password?token=${token}`}`
      );
    }

    res.json({
      success: true,
      data: { message: 'If an account exists for that email, a reset link has been generated.' },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({ success: false, error: { message: 'Invalid input data' } });
      return;
    }
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    const entry = resetTokens.get(hashResetToken(token));

    if (!entry || entry.expiresAt < Date.now()) {
      res.status(400).json({ success: false, error: { message: 'Reset link is invalid or has expired' } });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: entry.userId }, data: { passwordHash } });
    resetTokens.delete(hashResetToken(token));

    res.json({ success: true, data: { message: 'Password reset successfully' } });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({ success: false, error: { message: 'Invalid input data' } });
      return;
    }
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
});

// DELETE /api/v1/auth/account
router.delete('/account', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'User not authenticated' },
      });
      return;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      });
      return;
    }

    // Delete user and all associated data (cascading delete)
    // Prisma will handle the cascading deletion based on the schema
    await prisma.user.delete({
      where: { id: userId },
    });

    // Clear the refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      data: { message: 'Account deleted successfully' },
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to delete account' },
    });
  }
});

export default router;
