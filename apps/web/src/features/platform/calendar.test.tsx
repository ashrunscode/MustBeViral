// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { fireEvent } from '@testing-library/react';
import { Calendar, monthGrid, shiftMonth, startOfWeek, weekDays } from './calendar';

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

  it.each([
    [new Date(2026, 10, 1), 'November 2026'],
    [new Date(2026, 2, 8), 'March 2026'],
    [new Date(2026, 9, 25), 'October 2026'],
  ])('advances by one calendar day across daylight-saving changes (%s)', (anchor) => {
    const grid = monthGrid(anchor);
    const keys = grid.map((day) => `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (let index = 1; index < grid.length; index += 1) {
      const previous = grid[index - 1];
      const current = grid[index];
      if (previous === undefined || current === undefined) throw new Error('gap');
      const expected = new Date(
        previous.getFullYear(),
        previous.getMonth(),
        previous.getDate() + 1,
      );
      expect([current.getFullYear(), current.getMonth(), current.getDate()]).toEqual([
        expected.getFullYear(),
        expected.getMonth(),
        expected.getDate(),
      ]);
    }
    const week = weekDays(anchor).map((day) => day.getDate());
    expect(new Set(week).size).toBe(7);
  });

  it('moves whole months from a month end without skipping one', () => {
    const later = shiftMonth(new Date(2026, 0, 31), 1);
    expect([later.getFullYear(), later.getMonth(), later.getDate()]).toEqual([2026, 1, 1]);
    const earlier = shiftMonth(new Date(2026, 2, 31), -1);
    expect([earlier.getFullYear(), earlier.getMonth(), earlier.getDate()]).toEqual([2026, 1, 1]);
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

  it('steps month by month from the 31st', () => {
    render(
      <Calendar
        scope="North Studio"
        items={[]}
        timeZone="America/Chicago"
        missing="No schedule command is registered."
        today={new Date(2026, 0, 31)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('January 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('February 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('March 2026');
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
