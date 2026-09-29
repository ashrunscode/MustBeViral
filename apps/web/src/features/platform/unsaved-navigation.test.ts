import { describe, expect, it, vi } from 'vitest';

import { attachUnsavedGuards, UNSAVED_LEAVE_MESSAGE } from './unsaved-navigation';

function fakeTarget() {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    history: { go: vi.fn() },
    addEventListener(type: string, listener: EventListener) {
      const bucket = listeners.get(type) ?? new Set();
      bucket.add(listener);
      listeners.set(type, bucket);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    },
    emit(type: string, event: Event) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
    count(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

describe('unsaved navigation guards', () => {
  it('does not attach listeners when the draft is saved', () => {
    const target = fakeTarget();
    const release = attachUnsavedGuards({
      dirty: false,
      confirmLeave: () => false,
      target,
    });
    expect(target.count('popstate')).toBe(0);
    release();
  });

  it('blocks browser back/forward until the operator confirms discard', () => {
    const target = fakeTarget();
    const confirmLeave = vi.fn(() => false);
    const release = attachUnsavedGuards({ dirty: true, confirmLeave, target });
    target.emit('popstate', new Event('popstate'));
    expect(confirmLeave).toHaveBeenCalledTimes(1);
    expect(target.history.go).toHaveBeenCalledWith(1);
    release();
    expect(target.count('popstate')).toBe(0);
  });

  it('lets confirmed back/forward proceed and intercepts in-app links', () => {
    const target = fakeTarget();
    attachUnsavedGuards({ dirty: true, confirmLeave: () => true, target });
    target.emit('popstate', new Event('popstate'));
    expect(target.history.go).not.toHaveBeenCalled();
    expect(UNSAVED_LEAVE_MESSAGE).toContain('not saved');
  });
});
