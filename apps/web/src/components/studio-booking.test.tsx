// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { studioEn } from './public-copy';
import { StudioLanding } from './studio-landing';
import { StudioPricing } from './studio-pricing';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Studio booking', () => {
  it.each(['home', 'pricing'] as const)(
    '%s explains the exact offer before handing booking to the phone, without collecting data',
    async (route) => {
      const request = vi.fn();
      vi.stubGlobal('fetch', request);
      const page = render(
        route === 'home' ? <StudioLanding locale="en" media={null} /> : <StudioPricing />,
      );
      const trigger = page.getAllByRole('link', { name: 'Book a test shoot.' })[0]!;
      trigger.focus();
      fireEvent.click(trigger);
      const dialog = await page.findByRole('dialog', { name: 'Book a test shoot.' });
      const booking = within(dialog);
      expect(booking.getByText('$700')).toBeTruthy();
      for (const line of studioEn.offers[0]!.includes) {
        expect(booking.getByText(line)).toBeTruthy();
      }
      expect(booking.getByRole('link', { name: studioEn.phone }).getAttribute('href')).toBe(
        'tel:+17138999346',
      );
      expect(dialog.textContent).toContain('Nothing is booked or charged on this page.');
      expect(dialog.querySelector('form, input, textarea')).toBeNull();
      expect(request).not.toHaveBeenCalled();
      fireEvent.keyDown(dialog, { key: 'Escape' });
      await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    },
  );

  it('keeps the existing Spanish phone path and adds no Spanish booking copy', () => {
    const page = render(<StudioLanding locale="es" media={null} />);
    const trigger = page.getAllByRole('link', { name: 'Agende un test shoot.' })[0]!;
    expect(trigger.getAttribute('href')).toBe('tel:+17138999346');
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false);
    expect(page.queryByRole('dialog')).toBeNull();
    expect(page.container.querySelector('form, input, textarea')).toBeNull();
  });
});
