'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';

import type { StudioHeroMedia as StudioHeroMediaRecord } from './public-copy';

/**
 * The one priority poster reserves the frame before any playback request. Controls stay outside
 * the picture. Reduced motion always keeps the poster; a late play promise cannot restart motion.
 */
export function StudioHeroMedia({
  alt,
  media,
  playLabel,
}: Readonly<{ alt: string; media: StudioHeroMediaRecord; playLabel: string }>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameId = useId();
  const statusId = useId();
  const [reduced, setReduced] = useState(false);
  const [checked, setChecked] = useState(false);
  const [started, setStarted] = useState(false);
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      setReduced(query.matches);
      setChecked(true);
      if (query.matches) {
        videoRef.current?.pause();
        setStarted(false);
        setRequested(false);
        setLoading(false);
        setFailed(false);
        setShown(false);
      }
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  const mountVideo = media.video !== undefined && checked && !reduced && started;

  useEffect(() => {
    if (!mountVideo || !requested) return;
    const video = videoRef.current;
    if (video === null) return;
    let current = true;
    void video
      .play()
      .then(() => {
        if (!current) return;
        setLoading(false);
        setShown(true);
      })
      .catch(() => {
        if (!current) return;
        setStarted(false);
        setRequested(false);
        setLoading(false);
        setFailed(true);
        setShown(false);
      });
    return () => {
      current = false;
      video.pause();
    };
  }, [mountVideo, requested]);

  function togglePlayback() {
    if (!checked || reduced) return;
    setFailed(false);
    if (requested) {
      videoRef.current?.pause();
      setRequested(false);
      setLoading(false);
      setShown(false);
    } else {
      setStarted(true);
      setRequested(true);
      setLoading(true);
    }
  }

  const status = reduced
    ? 'Reduced motion is on. The poster stays still.'
    : failed
      ? `The film could not play. Try ${playLabel} again.`
      : loading
        ? 'Loading the film…'
        : '';

  return (
    <div className="studio-hero">
      <div
        className="studio-frame__media"
        id={frameId}
        style={{ aspectRatio: `${media.poster.width} / ${media.poster.height}` }}
      >
        <Image
          alt={alt}
          className="studio-hero__poster"
          fill
          priority
          sizes="(min-width: 1280px) 1100px, (min-width: 768px) calc(100vw - 104px), calc(100vw - 66px)"
          src={media.poster.src}
        />
        {mountVideo && media.video !== undefined ? (
          <video
            ref={videoRef}
            aria-hidden="true"
            className={`studio-hero__video${shown ? ' is-shown' : ''}`}
            loop
            muted
            playsInline
            poster={media.poster.src}
            preload="metadata"
            onError={() => {
              setStarted(false);
              setRequested(false);
              setLoading(false);
              setFailed(true);
              setShown(false);
            }}
          >
            <source src={media.video.src} type="video/mp4" />
            {media.video.captions === undefined ? null : (
              <track
                default
                kind="captions"
                label="English captions"
                src={media.video.captions}
                srcLang="en"
              />
            )}
          </video>
        ) : null}
      </div>
      {media.video !== undefined ? (
        <div className="studio-hero__controls">
          <button
            className="pub-play"
            aria-controls={frameId}
            aria-describedby={statusId}
            aria-pressed={requested}
            disabled={!checked || reduced}
            type="button"
            onClick={togglePlayback}
          >
            {requested ? 'Pause the film' : playLabel}
          </button>
          <p id={statusId} role="status">
            {status}
          </p>
        </div>
      ) : null}
    </div>
  );
}
