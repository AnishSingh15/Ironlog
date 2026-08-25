import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'IronLog - Professional Fitness Tracking',
  description:
    'Track your workouts, monitor progress, and achieve your fitness goals with IronLog.',
};

const capabilities = [
  {
    title: 'Real workout tracking',
    description: 'Log every set against your actual training history, not a generic template.',
  },
  {
    title: 'AI training coach',
    description: 'Progression and plateau analysis grounded in your logged sets, not guesses.',
  },
  {
    title: 'Built-in rest timer',
    description: 'Stay on rhythm mid-session without reaching for a separate app.',
  },
  {
    title: 'Progress analytics',
    description: 'Volume, frequency, and trend data that answers real training questions.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-20 md:pt-28">
        <div className="max-w-2xl">
          <p className="font-mono text-sm font-medium text-accent">IRONLOG</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-text-primary md:text-6xl">
            Training, measured.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-text-secondary">
            Log every set, see real progression, and get coaching grounded in your own training
            data - not a generic plan.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              data-testid="register-link"
              className="inline-flex h-12 items-center rounded-lg bg-accent px-6 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              Get started
            </Link>
            <Link
              href="/login"
              data-testid="login-link"
              className="inline-flex h-12 items-center rounded-lg border border-border-strong px-6 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-2"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border-default bg-border-default sm:grid-cols-2">
          {capabilities.map(item => (
            <div key={item.title} className="bg-surface-1 p-6">
              <h3 className="text-base font-semibold text-text-primary">{item.title}</h3>
              <p className="mt-2 text-sm text-text-secondary">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
