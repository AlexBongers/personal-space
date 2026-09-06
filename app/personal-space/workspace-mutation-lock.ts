type LockListener = (locked: boolean) => void;

// Google sync and workspace editors share one runtime in a tab. Other tabs are
// protected by the D1 CAS revision; this lock prevents a same-tab mutation race
// while the integration request is using its flushed snapshot.
let holder: string | null = null;
const listeners = new Set<LockListener>();

export const isWorkspaceMutationLocked = () => holder !== null;

export const subscribeWorkspaceMutationLock = (listener: LockListener) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const acquireWorkspaceMutationLock = (owner: string): (() => void) | null => {
  if (holder && holder !== owner) return null;
  holder = owner;
  for (const listener of listeners) listener(true);
  let released = false;
  return () => {
    if (released || holder !== owner) return;
    released = true;
    holder = null;
    for (const listener of listeners) listener(false);
  };
};
