export const UNSAVED_LEAVE_MESSAGE =
  'Your latest edits are not saved. Leave this page and discard them?';

export function attachUnsavedGuards(options: {
  dirty: boolean;
  confirmLeave: () => boolean;
  target: {
    addEventListener: (type: string, listener: EventListener, capture?: boolean) => void;
    removeEventListener: (type: string, listener: EventListener, capture?: boolean) => void;
    history: { go: (delta: number) => void };
  };
}): () => void {
  if (!options.dirty) return () => undefined;
  const unload = (event: Event) => {
    event.preventDefault();
    (event as BeforeUnloadEvent).returnValue = '';
  };
  const link = (event: Event) => {
    const mouse = event as MouseEvent;
    const anchor = mouse.target instanceof Element ? mouse.target.closest('a[href]') : null;
    if (!anchor) return;
    if (!options.confirmLeave()) {
      mouse.preventDefault();
      mouse.stopPropagation();
    }
  };
  const onPop = () => {
    if (!options.confirmLeave()) options.target.history.go(1);
  };
  options.target.addEventListener('beforeunload', unload);
  options.target.addEventListener('click', link, true);
  options.target.addEventListener('popstate', onPop);
  return () => {
    options.target.removeEventListener('beforeunload', unload);
    options.target.removeEventListener('click', link, true);
    options.target.removeEventListener('popstate', onPop);
  };
}
