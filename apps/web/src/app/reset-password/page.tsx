'use client';

import { ThemeToggleSwitch } from '@/components/ThemeToggleSwitch';
import { Button as IlButton } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircleOutline, ErrorOutline } from '@mui/icons-material';
import { Box, CircularProgress, TextField } from '@mui/material';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setError('Missing reset token. Use the link from your reset email.');
      return;
    }

    setError('');
    setIsLoading(true);
    const response = await api.resetPassword(token, data.newPassword);
    setIsLoading(false);

    if (response.success) {
      setSubmitted(true);
      setTimeout(() => router.push('/login'), 2000);
    } else {
      setError(response.error?.message || 'Reset link is invalid or has expired.');
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
          <p className="mt-2 text-sm text-text-secondary">Choose a new password.</p>
        </div>

        {!token && !submitted && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            <ErrorOutline fontSize="small" />
            This link is missing its reset token.
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            <ErrorOutline fontSize="small" />
            {error}
          </div>
        )}

        {submitted ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircleOutline className="text-success" fontSize="large" />
            <p className="text-sm text-text-primary">Password reset. Redirecting to sign in...</p>
          </div>
        ) : (
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <TextField
              {...register('newPassword')}
              label="New password"
              type="password"
              fullWidth
              error={!!errors.newPassword}
              helperText={errors.newPassword?.message}
            />
            <TextField
              {...register('confirmPassword')}
              label="Confirm new password"
              type="password"
              fullWidth
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
            />
            <IlButton type="submit" size="lg" disabled={isLoading || !token} className="mt-1 w-full">
              {isLoading ? <CircularProgress size={18} className="!text-accent-foreground" /> : 'Reset password'}
            </IlButton>
          </Box>
        )}

        <p className="mt-6 text-center text-sm text-text-secondary">
          <Link href="/login" className="font-semibold text-accent">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
