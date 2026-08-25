'use client';

import { ThemeToggleSwitch } from '@/components/ThemeToggleSwitch';
import { Button as IlButton } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/validations';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircleOutline } from '@mui/icons-material';
import { Box, CircularProgress, TextField } from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    await api.forgotPassword(data.email);
    setIsLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="absolute right-5 top-5">
        <ThemeToggleSwitch />
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border-default bg-surface-1 p-8">
        <div className="mb-7 text-center">
          <p className="font-mono text-xl font-bold tracking-tight text-text-primary">IRONLOG</p>
          <p className="mt-2 text-sm text-text-secondary">Reset your password.</p>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircleOutline className="text-success" fontSize="large" />
            <p className="text-sm text-text-primary">
              If an account exists for that email, a reset link has been generated.
            </p>
            <p className="text-xs text-text-tertiary">
              No email delivery is configured yet - in development, check the server logs for the
              link.
            </p>
          </div>
        ) : (
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <TextField
              {...register('email')}
              label="Email address"
              type="email"
              fullWidth
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <IlButton type="submit" size="lg" disabled={isLoading} className="mt-1 w-full">
              {isLoading ? <CircularProgress size={18} className="!text-accent-foreground" /> : 'Send reset link'}
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
