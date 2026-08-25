'use client';

import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider } from '@/components/theme-provider';
import { WeightUnitProvider } from '@/contexts/WeightUnitContext';
import { CssBaseline } from '@mui/material';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { useTheme } from 'next-themes';
import { ReactNode, useEffect, useState } from 'react';

// IronLog design tokens - kept in sync with the CSS variables in globals.css and
// documented in apps/web/DESIGN.md. One locked accent (Signal Blue); near-black /
// near-white surfaces, never pure; a surface ladder instead of shadows on dark.
const createAppTheme = (mode: 'light' | 'dark') => {
  const tokens =
    mode === 'light'
      ? {
          canvas: '#fafafa',
          surface1: '#ffffff',
          surface2: '#f2f2f3',
          surface3: '#e9e9eb',
          border: '#e4e4e7',
          borderStrong: '#d4d4d8',
          textPrimary: '#18181b',
          textSecondary: '#52525b',
          textTertiary: '#8a8a92',
          accent: '#2F6FED',
          accentForeground: '#ffffff',
          success: '#1E9A5C',
          warning: '#B4740B',
          danger: '#C93B3F',
        }
      : {
          canvas: '#0a0a0c',
          surface1: '#131316',
          surface2: '#1a1a1e',
          surface3: '#212126',
          border: '#2a2a30',
          borderStrong: '#3a3a42',
          textPrimary: '#f2f2f4',
          textSecondary: '#a3a3ab',
          textTertiary: '#6b6b74',
          accent: '#5B8DFF',
          accentForeground: '#0a0a0c',
          success: '#3DD68C',
          warning: '#E8A33D',
          danger: '#E5484D',
        };

  return createTheme({
    palette: {
      mode,
      primary: {
        main: tokens.accent,
        contrastText: tokens.accentForeground,
      },
      secondary: {
        main: tokens.surface2,
        contrastText: tokens.textPrimary,
      },
      success: {
        main: tokens.success,
        contrastText: tokens.accentForeground,
      },
      warning: {
        main: tokens.warning,
        contrastText: tokens.accentForeground,
      },
      error: {
        main: tokens.danger,
        contrastText: tokens.accentForeground,
      },
      background: {
        default: tokens.canvas,
        paper: tokens.surface1,
      },
      text: {
        primary: tokens.textPrimary,
        secondary: tokens.textSecondary,
      },
      divider: tokens.border,
      action: {
        hover: tokens.surface2,
        selected: tokens.surface3,
      },
    },
    typography: {
      fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
      h1: { fontWeight: 600, fontSize: '2.5rem', lineHeight: 1.15, letterSpacing: '-0.01em' },
      h2: { fontWeight: 600, fontSize: '2rem', lineHeight: 1.2, letterSpacing: '-0.01em' },
      h3: { fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.3 },
      h4: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.35 },
      h5: { fontWeight: 500, fontSize: '1.125rem', lineHeight: 1.4 },
      h6: { fontWeight: 500, fontSize: '1rem', lineHeight: 1.4 },
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
            boxShadow: mode === 'light' ? '0 1px 2px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06)' : 'none',
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
};

function MuiThemeWrapper({ children }: { children: ReactNode }) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use light theme as fallback during initial server render to prevent hydration mismatch
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
          <AuthProvider>{children}</AuthProvider>
        </MuiThemeWrapper>
      </ThemeProvider>
    </WeightUnitProvider>
  );
}
