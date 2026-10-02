// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StudioHeroMedia as StudioHeroMediaRecord } from './public-copy';
import { StudioHeroMedia } from './studio-hero-media';

const media: StudioHeroMediaRecord = {
  poster: { src: '/studio/hero-poster.jpg', width: 1080, height: 1350 },
  video: { src: '/studio/hero.mp4', captions: '/studio/hero.vtt' },
  alt: { en: 'A Houston crew films a storefront.', es: 'Un equipo filma un local en Houston.' },
};

function stubReducedMotion(matches: boolean) {
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('StudioHeroMedia', () => {
  it('mounts the clip after the poster, muted, inline, metadata only, with captions', async () => {
    stubReducedMotion(false);
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
    const { container } = render(
      <StudioHeroMedia alt={media.alt.en} media={media} playLabel="Play the film" />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.hasAttribute('autoplay')).toBe(false);
    expect(video?.getAttribute('preload')).toBe('metadata');
    expect(video?.hasAttribute('playsinline')).toBe(true);
    expect(video?.muted).toBe(true);
    expect(container.querySelector('track[kind="captions"]')?.getAttribute('src')).toBe(
      '/studio/hero.vtt',
    );
    expect(play).toHaveBeenCalled();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe(media.alt.en);
  });

  it('keeps the clip paused under reduced motion until the visitor presses play', async () => {
    stubReducedMotion(true);
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
    const { container, getByRole } = render(
      <StudioHeroMedia alt={media.alt.en} media={media} playLabel="Play the film" />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('video')).toBeNull();
    expect(play).not.toHaveBeenCalled();
    await act(async () => {
      getByRole('button', { name: 'Play the film' }).click();
    });
    expect(container.querySelector('video')).not.toBeNull();
    expect(play).toHaveBeenCalled();
  });
});
