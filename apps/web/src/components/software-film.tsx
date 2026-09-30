'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { softwareCopy, softwareFilm } from './public-copy';

export function SoftwareFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  const [checked, setChecked] = useState(false);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      setReduced(media.matches);
      setChecked(true);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  const mountVideo = checked && (!reduced || armed);

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
    <figure className="pub-film">
      <div className="pub-film__frame">
        <Image
          alt={softwareCopy.alt}
          fill
          priority
          sizes="(min-width: 960px) 960px, 100vw"
          src={softwareFilm.poster}
        />
        {mountVideo ? (
          <video
            ref={videoRef}
            className={shown ? 'is-shown' : undefined}
            controls
            muted
            playsInline
            poster={softwareFilm.poster}
            preload="none"
            onPlaying={() => setShown(true)}
          >
            <source src={softwareFilm.video} type="video/mp4" />
            <track kind="captions" label="English" src={softwareFilm.captions} srcLang="en" />
          </video>
        ) : null}
      </div>
      <figcaption>{softwareCopy.label}</figcaption>
      {checked && reduced && !armed ? (
        <button className="pub-play" type="button" onClick={() => setArmed(true)}>
          {softwareCopy.play}
        </button>
      ) : null}
    </figure>
  );
}
