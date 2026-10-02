'use client';
import Link from 'next/link';
import { useState } from 'react';

export interface CalendarItem {
  readonly id: string;
  readonly brand: string;
  readonly channel: string;
  readonly status: string;
  readonly at: string;
  readonly owner: string;
  readonly revision: string;
}

export type CalendarRange = 'week' | 'month';

/** The same local calendar day shifted by whole days, safe across daylight-saving changes. */
export function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** The first day of the month `direction` months away, so no month is skipped from a 31st. */
export function shiftMonth(anchor: Date, direction: -1 | 1): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

export function startOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (copy.getDay() + 6) % 7; // Monday first
  copy.setDate(copy.getDate() - day);
  return copy;
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const end = addDays(startOfWeek(last), 6);
  const days: Date[] = [];
  for (let day = start; day.getTime() <= end.getTime(); day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

export function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function calendarTimeZone(preferred?: string | null): string {
  if (preferred) return preferred;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * A view of durable scheduled revisions. No publication or schedule command is registered yet, so
 * the grid is real and the item list is empty; the empty state names the action that does exist.
 */
export function Calendar({
  scope,
  items,
  timeZone,
  action,
  missing,
  today = new Date(),
}: Readonly<{
  scope: string;
  items: readonly CalendarItem[];
  timeZone?: string | null;
  action?: { readonly href: string; readonly label: string } | undefined;
  missing: string;
  today?: Date;
}>) {
  const [range, setRange] = useState<CalendarRange>('week');
  const [anchor, setAnchor] = useState(() => new Date(today));
  const zone = calendarTimeZone(timeZone);
  const days = range === 'week' ? weekDays(anchor) : monthGrid(anchor);
  const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
    anchor,
  );
  const dayLabel = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric' });
  const move = (direction: -1 | 1) => {
    setAnchor(range === 'week' ? addDays(anchor, 7 * direction) : shiftMonth(anchor, direction));
  };
  return (
    <section className="platform-calendar" aria-label={`${scope} calendar`}>
      <div className="platform-calendar__bar">
        <div className="platform-row">
          <button type="button" onClick={() => move(-1)} aria-label="Earlier">
            Earlier
          </button>
          <h2 className="platform-calendar__month" aria-live="polite">
            {monthLabel}
          </h2>
          <button type="button" onClick={() => move(1)} aria-label="Later">
            Later
          </button>
        </div>
        <div className="platform-row">
          <span className="platform-muted">Times in {zone}</span>
          <div className="platform-segmented" role="group" aria-label="Calendar range">
            {(['week', 'month'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={range === option}
                onClick={() => setRange(option)}
              >
                {option === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <ol
        className={`platform-calendar__grid platform-calendar__grid--${range}`}
        aria-label={`${range === 'week' ? 'Week' : 'Month'} of ${monthLabel}`}
      >
        {days.map((day) => {
          const dayItems = items.filter((item) => sameDay(new Date(item.at), day));
          const outside = day.getMonth() !== anchor.getMonth();
          return (
            <li
              key={day.toISOString()}
              className={`platform-calendar__day${sameDay(day, today) ? ' is-today' : ''}${
                outside && range === 'month' ? ' is-outside' : ''
              }`}
            >
              <span className="platform-calendar__date">{dayLabel.format(day)}</span>
              {dayItems.length === 0 ? (
                <span className="platform-calendar__none">Nothing scheduled</span>
              ) : (
                <ul className="platform-calendar__items">
                  {dayItems.map((item) => (
                    <li key={item.id}>
                      <strong>{item.brand}</strong> {item.channel}, {item.status}, {item.owner},
                      revision {item.revision}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      {items.length === 0 ? (
        <div className="platform-note platform-stack" role="status">
          <p>
            Nothing is scheduled for {scope}. Scheduling starts after a channel is connected and a
            revision is approved.
          </p>
          <p className="platform-muted">{missing}</p>
          {action ? (
            <Link className="platform-button platform-primary" href={action.href}>
              {action.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export const SCHEDULE_CONTRACT_MISSING =
  'No schedule or publication command is registered in this release, so there is nothing to create, move or cancel here yet.';
