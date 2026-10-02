'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { softwareBeats, softwareCopy, softwareFilm } from './public-copy';

function beatAt(seconds: number) {
  let index = -1;
  softwareBeats.forEach((entry, i) => {
    if (seconds >= entry.at) index = i;
  });
  return index;
}

function beatState(index: number, running: number) {
  if (index === running) return 'running';
  return index < running ? 'done' : 'waiting';
}

function clock(seconds: number) {
  return `0:${String(seconds).padStart(2, '0')}`;
}

/**
 * The poster is the one priority image on the route. The clip mounts after it, muted and inline,
 * and stays out of the tab order until it is actually showing. The four beats sit beside the film:
 * the beat that is running is marked while it runs, and choosing a beat seeks the film to it. Under
 * reduced motion nothing plays until the visitor asks, with the play control or by choosing a beat.
 */
export function SoftwareFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingBeat = useRef<number | null>(null);
  const [reduced, setReduced] = useState(false);
  const [checked, setChecked] = useState(false);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);
  const [beat, setBeat] = useState(-1);

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
    const pending = pendingBeat.current;
    if (pending !== null) {
      pendingBeat.current = null;
      video.currentTime = softwareBeats[pending]?.at ?? 0;
    }
    void video
      .play()
      .then(() => setShown(true))
      .catch(() => {
        if (armed) setShown(true);
      });
  }, [armed, mountVideo]);

  const chooseBeat = (index: number) => {
    const video = videoRef.current;
    if (!mountVideo || video === null) {
      pendingBeat.current = index;
      setArmed(true);
      return;
    }
    video.currentTime = softwareBeats[index]?.at ?? 0;
    setBeat(index);
    void video.play().catch(() => undefined);
  };

  return (
    <div className="pub-stage">
      <figure className="pub-film">
        <div className="pub-film__frame">
          <Image
            alt={softwareCopy.alt}
            fill
            priority
            sizes="(min-width: 1280px) 720px, (min-width: 960px) 960px, 100vw"
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
              onTimeUpdate={(event) => {
                const next = beatAt(event.currentTarget.currentTime);
                setBeat((current) => (current === next ? current : next));
              }}
            >
              <source src={softwareFilm.video} type="video/mp4" />
              <track kind="captions" label="English" src={softwareFilm.captions} srcLang="en" />
            </video>
          ) : null}
        </div>
        <figcaption>{softwareCopy.label}</figcaption>
        <button
          className="pub-play pub-play--reduced-motion"
          hidden={armed}
          type="button"
          onClick={() => setArmed(true)}
        >
          {softwareCopy.play}
        </button>
      </figure>
      <ol className="pub-path" aria-label={softwareCopy.pathLabel}>
        {softwareBeats.map((entry, index) => (
          <li
            key={entry.at}
            aria-current={index === beat ? 'step' : undefined}
            data-beat={beatState(index, beat)}
          >
            <button className="pub-beat" type="button" onClick={() => chooseBeat(index)}>
              <span className="pub-beat__time">{clock(entry.at)}</span>
              <span className="pub-beat__line">{entry.line}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
