'use client';

import { Dialog } from '@mustbeviral/ui';
import { useState } from 'react';

import { phoneHref, studioCopy, studioEn, type StudioLocale } from './public-copy';

/** Booking remains a human phone conversation; this page never reserves a date or collects data. */
export function StudioBookingActions({ locale }: Readonly<{ locale: StudioLocale }>) {
  const [open, setOpen] = useState(false);
  const copy = studioCopy[locale];
  const offer = studioEn.offers[0];

  return (
    <>
      <div className="pub-actions">
        <a
          className="pub-cta"
          href={phoneHref}
          aria-haspopup={locale === 'en' ? 'dialog' : undefined}
          onClick={(event) => {
            if (
              locale !== 'en' ||
              event.ctrlKey ||
              event.metaKey ||
              event.shiftKey ||
              event.altKey
            ) {
              return;
            }
            event.preventDefault();
            setOpen(true);
          }}
        >
          {copy.cta}
        </a>
        <a className="pub-phone" href={phoneHref}>
          {copy.phone}
        </a>
      </div>
      {locale === 'en' && offer !== undefined ? (
        <Dialog
          className="studio-booking-dialog"
          open={open}
          onClose={() => setOpen(false)}
          title={studioEn.cta}
          description="Call to agree the date and editing schedule. Nothing is booked or charged on this page."
        >
          <div className="studio-booking">
            <p className="studio-offer__price">
              <span className="pub-price">{offer.price}</span>
              <span className="pub-price-unit">{offer.unit}</span>
            </p>
            <ul className="studio-offer__includes">
              {offer.includes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <a className="pub-cta" href={phoneHref}>
              {studioEn.phone}
            </a>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
