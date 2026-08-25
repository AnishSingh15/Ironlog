'use client';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button as IlButton } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { registerSchema, type RegisterFormData } from '@/lib/validations';
import { zodResolver } from '@hookform/resolvers/zod';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { Alert, Box, CircularProgress, IconButton, InputAdornment, TextField } from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

export default function RegisterPage() {
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register: registerUser, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError('');
    try {
      const result = await registerUser(data.name || '', data.email, data.password);
      if (!result.success) {
        setError(result.error || 'Registration failed');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border-default bg-surface-1 p-8">
        <div className="mb-7 text-center">
          <p className="font-mono text-xl font-bold tracking-tight text-text-primary">IRONLOG</p>
          <p className="mt-2 text-sm text-text-secondary">Create your account to start training.</p>
        </div>

        {error && (
          <Alert severity="error" className="!mb-4 !rounded-lg">
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <TextField
            required
            fullWidth
            label="Full name"
            type="text"
            autoComplete="name"
            error={!!errors.name}
            helperText={errors.name?.message}
            {...register('name')}
            inputProps={{ 'data-testid': 'name-input' }}
          />

          <TextField
            required
            fullWidth
            label="Email address"
            type="email"
            autoComplete="email"
            error={!!errors.email}
            helperText={errors.email?.message}
            {...register('email')}
            inputProps={{ 'data-testid': 'email-input' }}
          />

          <TextField
            required
            fullWidth
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            error={!!errors.password}
            helperText={errors.password?.message}
            {...register('password')}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    size="small"
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            inputProps={{ 'data-testid': 'password-input' }}
          />

          <TextField
            required
            fullWidth
            label="Confirm password"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword?.message}
            {...register('confirmPassword')}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle confirm password visibility"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    edge="end"
                    size="small"
                  >
                    {showConfirmPassword ? (
                      <VisibilityOff fontSize="small" />
                    ) : (
                      <Visibility fontSize="small" />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            inputProps={{ 'data-testid': 'confirm-password-input' }}
          />

          <IlButton
            type="submit"
            size="lg"
            disabled={isLoading}
            data-testid="register-button"
            className="mt-1 w-full"
          >
            {isLoading ? <CircularProgress size={18} className="!text-accent-foreground" /> : 'Create account'}
          </IlButton>
        </Box>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-accent">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
