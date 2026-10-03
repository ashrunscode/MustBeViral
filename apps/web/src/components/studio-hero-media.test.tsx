// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StudioHeroMedia as StudioHeroMediaRecord } from './public-copy';
import { StudioHeroMedia } from './studio-hero-media';

const media: StudioHeroMediaRecord = {
  poster: { src: '/films/fixture-poster.jpg', width: 1920, height: 1080 },
  video: { src: '/films/fixture.mp4' },
  alt: { en: 'Two hands adjust a camera on a gimbal in a generated room.', es: '' },
};

function stubReducedMotion(matches: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(query));
  return (next: boolean) => {
    query.matches = next;
    for (const listener of listeners) listener();
  };
}

function playback() {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  return { play, pause };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('StudioHeroMedia', () => {
  it('keeps the priority poster first and starts a silent inline clip only on an explicit request', async () => {
    stubReducedMotion(false);
    const { play, pause } = playback();
    const { container, getByRole } = render(
      <StudioHeroMedia alt={media.alt.en} media={media} playLabel="Play the film" />,
    );
    expect(container.querySelector('video')).toBeNull();
    expect(play).not.toHaveBeenCalled();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe(media.alt.en);
    const frame = container.querySelector('.studio-frame__media');
    expect(frame?.getAttribute('style')).toContain('aspect-ratio: 1920 / 1080');
    const control = getByRole('button', { name: 'Play the film' });
    expect(frame?.contains(control)).toBe(false);
    expect(control.getAttribute('aria-controls')).toBe(frame?.id);
    await act(async () => {
      control.click();
    });
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.hasAttribute('autoplay')).toBe(false);
    expect(video?.getAttribute('preload')).toBe('metadata');
    expect(video?.hasAttribute('playsinline')).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video?.hasAttribute('controls')).toBe(false);
    expect(container.querySelector('track')).toBeNull();
    expect(play).toHaveBeenCalledTimes(1);
    const pauseControl = getByRole('button', { name: 'Pause the film' });
    expect(pauseControl.getAttribute('aria-pressed')).toBe('true');
    await act(async () => pauseControl.click());
    expect(pause).toHaveBeenCalled();
    expect(getByRole('button', { name: 'Play the film' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('never mounts or plays the clip under reduced motion, including an attempted play request', async () => {
    stubReducedMotion(true);
    const { play } = playback();
    const { container, getByRole } = render(
      <StudioHeroMedia alt={media.alt.en} media={media} playLabel="Play the film" />,
    );
    expect(container.querySelector('video')).toBeNull();
    expect(play).not.toHaveBeenCalled();
    const control = getByRole('button', { name: 'Play the film' }) as HTMLButtonElement;
    expect(control.disabled).toBe(true);
    expect(getByRole('status').textContent).toContain(
      'Reduced motion is on. The poster stays still.',
    );
    await act(async () => {
      control.click();
    });
    expect(container.querySelector('video')).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it('stops immediately when reduced motion changes and requires a fresh request when it changes back', async () => {
    const setReduced = stubReducedMotion(false);
    const { play, pause } = playback();
    const { container, getByRole } = render(
      <StudioHeroMedia alt={media.alt.en} media={media} playLabel="Play the film" />,
    );
    await act(async () => getByRole('button', { name: 'Play the film' }).click());
    expect(container.querySelector('video')).not.toBeNull();
    await act(async () => setReduced(true));
    expect(container.querySelector('video')).toBeNull();
    expect(pause).toHaveBeenCalled();
    await act(async () => setReduced(false));
    expect(container.querySelector('video')).toBeNull();
    expect(play).toHaveBeenCalledTimes(1);
    expect(getByRole('button', { name: 'Play the film' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('keeps the poster and announces a failed start with a retry action', async () => {
    stubReducedMotion(false);
    const { play } = playback();
    play.mockRejectedValueOnce(new Error('Synthetic playback failure'));
    const { container, getByRole } = render(
      <StudioHeroMedia alt={media.alt.en} media={media} playLabel="Play the film" />,
    );
    await act(async () => getByRole('button', { name: 'Play the film' }).click());
    expect(getByRole('status').textContent).toBe(
      'The film could not play. Try Play the film again.',
    );
    expect(container.querySelector('video.is-shown')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')).not.toBeNull();
    await act(async () => getByRole('button', { name: 'Play the film' }).click());
    expect(play).toHaveBeenCalledTimes(2);
    expect(getByRole('button', { name: 'Pause the film' })).not.toBeNull();
    expect(getByRole('status').textContent).toBe('');
  });

  it('lets the visitor cancel a pending start without a late promise showing motion', async () => {
    stubReducedMotion(false);
    const { play, pause } = playback();
    let finish: (() => void) | undefined;
    play.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { container, getByRole } = render(
      <StudioHeroMedia alt={media.alt.en} media={media} playLabel="Play the film" />,
    );
    await act(async () => getByRole('button', { name: 'Play the film' }).click());
    expect(getByRole('status').textContent).toBe('Loading the film…');
    await act(async () => getByRole('button', { name: 'Pause the film' }).click());
    await act(async () => finish?.());
    expect(pause).toHaveBeenCalled();
    expect(container.querySelector('video.is-shown')).toBeNull();
    expect(getByRole('button', { name: 'Play the film' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(getByRole('status').textContent).toBe('');
  });

  it('ignores a late playback promise after reduced motion unmounts the clip', async () => {
    const setReduced = stubReducedMotion(false);
    const { play } = playback();
    let finish: (() => void) | undefined;
    play.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { container, getByRole } = render(
      <StudioHeroMedia alt={media.alt.en} media={media} playLabel="Play the film" />,
    );
    await act(async () => getByRole('button', { name: 'Play the film' }).click());
    await act(async () => setReduced(true));
    await act(async () => finish?.());
    expect(container.querySelector('video')).toBeNull();
    expect(getByRole('status').textContent).toBe('Reduced motion is on. The poster stays still.');
  });

  it('recovers from a media error without showing the broken clip', async () => {
    stubReducedMotion(false);
    playback();
    const { container, getByRole } = render(
      <StudioHeroMedia alt={media.alt.en} media={media} playLabel="Play the film" />,
    );
    await act(async () => getByRole('button', { name: 'Play the film' }).click());
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    fireEvent.error(video as HTMLVideoElement);
    expect(container.querySelector('video.is-shown')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
    expect(getByRole('status').textContent).toContain('could not play');
    expect(getByRole('button', { name: 'Play the film' })).not.toBeNull();
    await act(async () => getByRole('button', { name: 'Play the film' }).click());
    expect(container.querySelector('video')).not.toBe(video);
    expect(getByRole('button', { name: 'Pause the film' })).not.toBeNull();
  });

  it('retains an English captions track for a future captioned fixture', async () => {
    stubReducedMotion(false);
    playback();
    // Synthetic captioned media fixture only; the shipped wordless plate has no captions.
    const captioned = {
      ...media,
      video: { src: '/films/fixture.mp4', captions: '/films/fixture.vtt' },
    };
    const { container, getByRole } = render(
      <StudioHeroMedia alt={media.alt.en} media={captioned} playLabel="Play the film" />,
    );
    await act(async () => getByRole('button', { name: 'Play the film' }).click());
    expect(container.querySelector('track[kind="captions"]')?.getAttribute('src')).toBe(
      '/films/fixture.vtt',
    );
    expect(container.querySelector('track')?.getAttribute('srclang')).toBe('en');
  });

  it('has no playback control or clip for a poster-only route', () => {
    stubReducedMotion(false);
    const { play } = playback();
    const { container, queryByRole } = render(
      <StudioHeroMedia
        alt=""
        media={{ poster: media.poster, alt: media.alt }}
        playLabel="Play the film"
      />,
    );
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('track')).toBeNull();
    expect(queryByRole('button')).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it('cancels a pending start when the component leaves the route', async () => {
    stubReducedMotion(false);
    const { play, pause } = playback();
    let finish: (() => void) | undefined;
    play.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { getByRole, unmount } = render(
      <StudioHeroMedia alt={media.alt.en} media={media} playLabel="Play the film" />,
    );
    await act(async () => getByRole('button', { name: 'Play the film' }).click());
    unmount();
    await act(async () => finish?.());
    expect(pause).toHaveBeenCalled();
  });
});
