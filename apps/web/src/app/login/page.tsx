'use client';

import { ThemeToggleSwitch } from '@/components/ThemeToggleSwitch';
import { Button as IlButton } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, type LoginFormData } from '@/lib/validations';
import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorOutline, Visibility, VisibilityOff } from '@mui/icons-material';
import { Box, CircularProgress, IconButton, InputAdornment, TextField } from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

export default function LoginPage() {
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    try {
      const result = await login(data.email, data.password);
      if (!result.success) {
        setError(result.error || 'Login failed');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="absolute right-5 top-5">
        <ThemeToggleSwitch />
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border-default bg-surface-1 p-8">
        <div className="mb-7 text-center">
          <p className="font-mono text-xl font-bold tracking-tight text-text-primary">IRONLOG</p>
          <p className="mt-2 text-sm text-text-secondary">Sign in to continue training.</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            <ErrorOutline fontSize="small" />
            {error}
          </div>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <TextField
            {...register('email')}
            label="Email address"
            type="email"
            fullWidth
            error={!!errors.email}
            helperText={errors.email?.message}
            inputProps={{ 'data-testid': 'email-input' }}
          />

          <TextField
            {...register('password')}
            label="Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            error={!!errors.password}
            helperText={errors.password?.message}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            inputProps={{ 'data-testid': 'password-input' }}
          />

          <Link href="/forgot-password" className="-mt-2 self-end text-xs font-medium text-accent">
            Forgot password?
          </Link>

          <IlButton type="submit" size="lg" disabled={isLoading} data-testid="login-button" className="mt-1 w-full">
            {isLoading ? <CircularProgress size={18} className="!text-accent-foreground" /> : 'Sign in'}
          </IlButton>
        </Box>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Don&apos;t have an account?{' '}
          <Link href="/register" data-testid="register-link" className="font-semibold text-accent">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
