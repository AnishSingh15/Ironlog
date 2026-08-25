'use client';

import { AppHeader } from '@/components/AppHeader';
import { ThemeToggleSwitch } from '@/components/ThemeToggleSwitch';
import { Button as IlButton } from '@/components/ui/Button';
import { Card as IlCard } from '@/components/ui/Card';
import { toast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { profileUpdateSchema } from '@/lib/validations';
import { useAuthStore } from '@/store/auth';
import {
  Cancel as CancelIcon,
  Edit as EditIcon,
  Logout as LogoutIcon,
  Palette as PaletteIcon,
  Person as PersonIcon,
  Save as SaveIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { TextField } from '@mui/material';
import { Field, Form, Formik } from 'formik';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod';

interface ProfileFormData {
  name: string;
  email: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { logout } = useAuth();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleProfileUpdate = async (values: ProfileFormData) => {
    try {

      profileUpdateSchema.parse(values);

      const response = await api.put('/auth/profile', values);

      setUser((response.data as any)?.user);
      toast.success('Profile updated successfully!');
      setIsEditingProfile(false);
    } catch (error: any) {
      console.error('Profile update failed:', error);
      if (error instanceof z.ZodError) {
        toast.error('Please check your input and try again.');
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to update profile. Please try again.');
      }
    }
  };

  const handlePasswordChange = async (values: PasswordFormData) => {
    try {

      if (values.newPassword !== values.confirmPassword) {
        toast.error('New passwords do not match.');
        return;
      }

      if (values.newPassword.length < 8) {
        toast.error('New password must be at least 8 characters long.');
        return;
      }

      await api.put('/auth/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      toast.success('Password changed successfully!');
      setIsChangingPassword(false);
    } catch (error: any) {
      console.error('Password change failed:', error);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to change password. Please try again.');
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !window.confirm('Are you sure you want to delete your account? This action cannot be undone.')
    ) {
      return;
    }

    try {
      await api.delete('/auth/account');
      logout();
      router.push('/');
    } catch (error: any) {
      console.error('Account deletion failed:', error);
      toast.error('Failed to delete account. Please try again.');
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <AppHeader title="Settings" showWeightToggle={false} />
      <div className="mx-auto max-w-2xl px-4 py-5 pb-24 md:pb-6">
        <IlCard className="mb-4">
          <div className="mb-4 flex items-center gap-2">
            <PersonIcon className="text-accent" fontSize="small" />
            <h2 className="text-base font-semibold text-text-primary">Profile information</h2>
          </div>

          {!isEditingProfile ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-text-tertiary">Full name</p>
                <p className="text-sm font-medium text-text-primary">{user.name}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Email address</p>
                <p className="text-sm font-medium text-text-primary">{user.email}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-text-tertiary">Member since</p>
                <p className="text-sm font-medium text-text-primary">
                  {new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          ) : (
            <Formik initialValues={{ name: user.name, email: user.email }} onSubmit={handleProfileUpdate}>
              {({ isSubmitting, values, handleChange, handleBlur }) => (
                <Form className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      as={TextField}
                      name="name"
                      label="Full name"
                      fullWidth
                      value={values.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      disabled={isSubmitting}
                    />
                    <Field
                      as={TextField}
                      name="email"
                      label="Email address"
                      type="email"
                      fullWidth
                      value={values.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="flex gap-2">
                    <IlButton type="submit" size="sm" disabled={isSubmitting}>
                      <SaveIcon fontSize="small" />
                      Save changes
                    </IlButton>
                    <IlButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsEditingProfile(false)}
                      disabled={isSubmitting}
                    >
                      <CancelIcon fontSize="small" />
                      Cancel
                    </IlButton>
                  </div>
                </Form>
              )}
            </Formik>
          )}

          {!isEditingProfile && (
            <IlButton variant="ghost" size="sm" className="mt-4" onClick={() => setIsEditingProfile(true)}>
              <EditIcon fontSize="small" />
              Edit profile
            </IlButton>
          )}
        </IlCard>

        <IlCard className="mb-4">
          <div className="mb-4 flex items-center gap-2">
            <SecurityIcon className="text-accent" fontSize="small" />
            <h2 className="text-base font-semibold text-text-primary">Security</h2>
          </div>

          {!isChangingPassword ? (
            <div>
              <p className="text-sm text-text-secondary">
                Change your password to keep your account secure.
              </p>
              <p className="mt-1 text-xs text-text-tertiary">Last updated: Never</p>
            </div>
          ) : (
            <Formik
              initialValues={{ currentPassword: '', newPassword: '', confirmPassword: '' }}
              onSubmit={handlePasswordChange}
            >
              {({ isSubmitting, values, handleChange, handleBlur }) => (
                <Form className="flex flex-col gap-4">
                  <Field
                    as={TextField}
                    name="currentPassword"
                    label="Current password"
                    type="password"
                    fullWidth
                    value={values.currentPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={isSubmitting}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      as={TextField}
                      name="newPassword"
                      label="New password"
                      type="password"
                      fullWidth
                      value={values.newPassword}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      disabled={isSubmitting}
                      helperText="Must be at least 8 characters"
                    />
                    <Field
                      as={TextField}
                      name="confirmPassword"
                      label="Confirm new password"
                      type="password"
                      fullWidth
                      value={values.confirmPassword}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="flex gap-2">
                    <IlButton type="submit" size="sm" disabled={isSubmitting}>
                      <SaveIcon fontSize="small" />
                      Change password
                    </IlButton>
                    <IlButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsChangingPassword(false)}
                      disabled={isSubmitting}
                    >
                      <CancelIcon fontSize="small" />
                      Cancel
                    </IlButton>
                  </div>
                </Form>
              )}
            </Formik>
          )}

          {!isChangingPassword && (
            <IlButton
              variant="ghost"
              size="sm"
              className="mt-4"
              onClick={() => setIsChangingPassword(true)}
            >
              <SecurityIcon fontSize="small" />
              Change password
            </IlButton>
          )}
        </IlCard>

        <IlCard className="mb-4">
          <div className="mb-4 flex items-center gap-2">
            <PaletteIcon className="text-accent" fontSize="small" />
            <h2 className="text-base font-semibold text-text-primary">Appearance</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Theme</p>
              <p className="text-xs text-text-tertiary">Switch between light and dark mode.</p>
            </div>
            <ThemeToggleSwitch />
          </div>
        </IlCard>

        <IlCard>
          <h2 className="mb-4 text-base font-semibold text-text-primary">Account actions</h2>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <IlButton variant="secondary" onClick={logout}>
              <LogoutIcon fontSize="small" />
              Sign out
            </IlButton>
            <IlButton variant="danger" onClick={handleDeleteAccount}>
              Delete account
            </IlButton>
          </div>

          <div className="my-4 h-px bg-border-default" />

          <p className="text-xs text-text-tertiary">
            Deleting your account is permanent and removes all your workout data. This cannot be
            undone.
          </p>
        </IlCard>
      </div>
    </>
  );
}
