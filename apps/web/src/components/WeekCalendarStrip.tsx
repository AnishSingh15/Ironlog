'use client';

import type { WeekCalendarDay } from '@/lib/api';
import { clsx } from 'clsx';
import { format, isToday, parseISO } from 'date-fns';

interface WeekCalendarStripProps {
  days: WeekCalendarDay[];
}

// "Planned" deliberately uses `info` (blue), not the accent red - the accent is reserved
// for actionable/significant moments (DESIGN.md Section 3), and a future day nothing has
// happened on yet isn't one. Keeping it a different hue from "Missed" also keeps the two
// states visually distinguishable at a glance, not just by a legend lookup.
const STATUS_DOT: Record<WeekCalendarDay['status'], string> = {
  completed: 'bg-success',
  planned: 'bg-info',
  missed: 'bg-danger',
  rest: 'bg-text-tertiary',
};

const STATUS_LABEL: Record<WeekCalendarDay['status'], string> = {
  completed: 'Completed',
  planned: 'Planned',
  missed: 'Missed',
  rest: 'Rest',
};

export function WeekCalendarStrip({ days }: WeekCalendarStripProps) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(day => {
          const date = parseISO(day.date);
          return (
            <div
              key={day.date}
              className={clsx(
                'flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2',
                isToday(date) ? 'border-accent' : 'border-border-default'
              )}
              title={`${format(date, 'EEE, MMM d')} - ${STATUS_LABEL[day.status]}`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
                {format(date, 'EEEEE')}
              </span>
              <span className={clsx('h-2 w-2 rounded-full', STATUS_DOT[day.status])} />
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {(Object.keys(STATUS_LABEL) as WeekCalendarDay['status'][]).map(status => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <span className={clsx('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
            {STATUS_LABEL[status]}
          </span>
        ))}
      </div>
    </div>
  );
}
