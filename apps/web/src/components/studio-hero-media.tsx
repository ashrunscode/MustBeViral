'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import type { StudioHeroMedia as StudioHeroMediaRecord } from './public-copy';

/**
 * Poster first, as the one priority image on the route. The clip mounts after the poster, muted,
 * inline, metadata only, with captions. Under reduced motion nothing plays until the visitor asks.
 */
export function StudioHeroMedia({
  alt,
  media,
  playLabel,
}: Readonly<{ alt: string; media: StudioHeroMediaRecord; playLabel: string }>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  const [checked, setChecked] = useState(false);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      setReduced(query.matches);
      setChecked(true);
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  const mountVideo = media.video !== undefined && checked && (!reduced || armed);

  useEffect(() => {
    if (!mountVideo) return;
    const video = videoRef.current;
    if (video === null) return;
    void video
      .play()
      .then(() => setShown(true))
      .catch(() => {
        if (armed) setShown(true);
      });
  }, [armed, mountVideo]);

  return (
    <>
      <Image
        alt={alt}
        className="studio-hero__poster"
        fill
        priority
        sizes="100vw"
        src={media.poster.src}
      />
      {mountVideo && media.video !== undefined ? (
        <video
          ref={videoRef}
          className={`studio-hero__video${shown ? ' is-shown' : ''}`}
          controls
          loop
          muted
          playsInline
          poster={media.poster.src}
          preload="metadata"
          onPlaying={() => setShown(true)}
        >
          <source src={media.video.src} type="video/mp4" />
          <track
            default
            kind="captions"
            label="English captions"
            src={media.video.captions}
            srcLang="en"
          />
        </video>
      ) : null}
      {media.video !== undefined ? (
        <button
          className="pub-play studio-hero__play"
          hidden={armed}
          type="button"
          onClick={() => setArmed(true)}
        >
          {playLabel}
        </button>
      ) : null}
    </>
  );
}
