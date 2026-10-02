// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Calendar, monthGrid, startOfWeek, weekDays } from './calendar';

afterEach(cleanup);

describe('calendar grid', () => {
  it('starts weeks on Monday and fills whole weeks around a month', () => {
    const wednesday = new Date(2026, 9, 7); // 7 October 2026
    expect(startOfWeek(wednesday).getDay()).toBe(1);
    expect(startOfWeek(wednesday).getDate()).toBe(5);
    const week = weekDays(wednesday);
    expect(week).toHaveLength(7);
    expect(week[0]?.getDate()).toBe(5);
    expect(week[6]?.getDate()).toBe(11);
    const grid = monthGrid(wednesday);
    expect(grid.length % 7).toBe(0);
    expect(grid[0]?.getDay()).toBe(1);
    expect(grid.at(-1)?.getDay()).toBe(0);
  });
});

describe('Calendar', () => {
  it('shows a real grid, names the missing contract, and offers the one legal action', () => {
    render(
      <Calendar
        scope="North Studio"
        items={[]}
        timeZone="America/Chicago"
        missing="No schedule command is registered."
        action={{ href: '/studio?view=brands', label: 'Open a brand' }}
        today={new Date(2026, 9, 1)}
      />,
    );
    expect(screen.getByRole('region', { name: 'North Studio calendar' })).toBeTruthy();
    expect(screen.getAllByText('Nothing scheduled')).toHaveLength(7);
    expect(screen.getByText('Times in America/Chicago')).toBeTruthy();
    expect(screen.getByText('No schedule command is registered.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open a brand' }).getAttribute('href')).toBe(
      '/studio?view=brands',
    );
    expect(screen.getByRole('button', { name: 'Week' }).getAttribute('aria-pressed')).toBe('true');
    expect(document.body.textContent).not.toMatch(/\b0 posts\b|\b0 scheduled\b/);
  });

  it('lists a scheduled item on its day with brand, channel, status, owner and revision', () => {
    render(
      <Calendar
        scope="UnPile"
        items={[
          {
            id: 'a',
            brand: 'UnPile',
            channel: 'Instagram',
            status: 'Approved',
            at: new Date(2026, 9, 2, 9).toISOString(),
            owner: 'Maya',
            revision: 'v3',
          },
        ]}
        missing="unused"
        today={new Date(2026, 9, 1)}
      />,
    );
    expect(screen.getAllByText('Nothing scheduled')).toHaveLength(6);
    expect(screen.getByText(/Instagram, Approved, Maya/)).toBeTruthy();
  });
});
