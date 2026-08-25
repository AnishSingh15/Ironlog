'use client';

import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { WeightUnitProvider } from '@/contexts/WeightUnitContext';
import { CssBaseline } from '@mui/material';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { useTheme } from 'next-themes';
import { ReactNode, useEffect, useState } from 'react';

// Every color below is a raw `var(--il-*)` reference into globals.css, not a resolved
// hex value - the browser re-resolves them automatically when next-themes toggles the
// `.dark` class, so this theme can never drift out of sync with the Tailwind tokens.
// See apps/web/DESIGN.md for the full token system.
const tokens = {
  canvas: 'hsl(var(--il-canvas))',
  surface1: 'hsl(var(--il-surface-1))',
  surface2: 'hsl(var(--il-surface-2))',
  surface3: 'hsl(var(--il-surface-3))',
  border: 'hsl(var(--il-border))',
  borderStrong: 'hsl(var(--il-border-strong))',
  textPrimary: 'hsl(var(--il-text-primary))',
  textSecondary: 'hsl(var(--il-text-secondary))',
  accent: 'hsl(var(--il-accent))',
  accentForeground: 'hsl(var(--il-accent-foreground))',
  success: 'hsl(var(--il-success))',
  warning: 'hsl(var(--il-warning))',
  danger: 'hsl(var(--il-danger))',
};

const createAppTheme = (mode: 'light' | 'dark') =>
  createTheme({
    palette: {
      mode,
      primary: { main: tokens.accent, contrastText: tokens.accentForeground },
      secondary: { main: tokens.surface2, contrastText: tokens.textPrimary },
      success: { main: tokens.success, contrastText: tokens.accentForeground },
      warning: { main: tokens.warning, contrastText: tokens.accentForeground },
      error: { main: tokens.danger, contrastText: tokens.accentForeground },
      background: { default: tokens.canvas, paper: tokens.surface1 },
      text: { primary: tokens.textPrimary, secondary: tokens.textSecondary },
      divider: tokens.border,
      action: { hover: tokens.surface2, selected: tokens.surface3 },
    },
    typography: {
      fontFamily: 'var(--font-manrope), system-ui, sans-serif',
      h1: { fontWeight: 700, fontSize: '2.5rem', lineHeight: 1.15, letterSpacing: '-0.01em' },
      h2: { fontWeight: 700, fontSize: '2rem', lineHeight: 1.2, letterSpacing: '-0.01em' },
      h3: { fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.3 },
      h4: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.35 },
      h5: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.4 },
      h6: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.4 },
      body1: { fontSize: '0.9375rem', lineHeight: 1.5 },
      body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            padding: '0.625rem 1.25rem',
            fontSize: '0.875rem',
            boxShadow: 'none',
            transition: 'transform 0.1s ease, opacity 0.15s ease',
            '&:hover': {
              boxShadow: 'none',
            },
            '&:active': {
              transform: 'scale(0.98)',
            },
          },
          contained: {
            backgroundColor: tokens.accent,
            color: tokens.accentForeground,
            '&:hover': {
              backgroundColor: tokens.accent,
              opacity: 0.9,
            },
          },
          outlined: {
            borderColor: tokens.borderStrong,
            color: tokens.textPrimary,
            '&:hover': {
              borderColor: tokens.accent,
              backgroundColor: 'transparent',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: '12px',
            border: `1px solid ${tokens.border}`,
            boxShadow: 'var(--il-shadow-float)',
            backgroundImage: 'none',
            background: tokens.surface1,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
              backgroundColor: tokens.surface1,
              '& fieldset': {
                borderColor: tokens.border,
              },
              '&:hover fieldset': {
                borderColor: tokens.borderStrong,
              },
              '&.Mui-focused fieldset': {
                borderColor: tokens.accent,
                borderWidth: '2px',
              },
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.canvas,
            backgroundImage: 'none',
            borderBottom: `1px solid ${tokens.border}`,
            boxShadow: 'none',
          },
        },
      },
    },
  });

function MuiThemeWrapper({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use light theme as fallback during initial server render to prevent hydration mismatch.
  // The palette values themselves are var() references, so only `mode` (which drives MUI's
  // own internal light/dark defaults) needs to track the resolved theme.
  const currentTheme = mounted ? (resolvedTheme === 'dark' ? 'dark' : 'light') : 'light';
  const muiTheme = createAppTheme(currentTheme);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WeightUnitProvider>
      <ThemeProvider>
        <MuiThemeWrapper>
          <TooltipProvider delayDuration={200}>
            <AuthProvider>{children}</AuthProvider>
          </TooltipProvider>
        </MuiThemeWrapper>
      </ThemeProvider>
    </WeightUnitProvider>
  );
}
