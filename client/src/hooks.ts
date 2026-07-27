import { useCallback, useEffect, useRef, useState } from 'react';

/** Reads and writes a JSON value in localStorage. */
export function useStored<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key);
    if (raw === null) return initial;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (next: T) => {
      setValue(next);
      localStorage.setItem(key, JSON.stringify(next));
    },
    [key],
  );
  return [value, update];
}

/** Returns a function that runs `fn` once the caller has been quiet for `delay` ms. */
export function useDebounced<A extends unknown[]>(fn: (...args: A) => void, delay = 350) {
  const latest = useRef(fn);
  latest.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return useCallback(
    (...args: A) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current(...args), delay);
    },
    [delay],
  );
}

export type Theme = 'light' | 'dark';

/** The light/dark choice, remembered across restarts and applied to the page. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useStored<Theme>('ps.theme', 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return [theme, () => setTheme(theme === 'light' ? 'dark' : 'light')];
}

/** The page id in the URL hash (`#/p/<id>`), kept in sync with history. */
export function useHashRoute(): [string | null, (id: string) => void] {
  const read = () => {
    const match = window.location.hash.match(/^#\/p\/(.+)$/);
    return match ? match[1] : null;
  };
  const [id, setId] = useState<string | null>(read);

  useEffect(() => {
    const onHashChange = () => setId(read());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: string) => {
    window.location.hash = `#/p/${next}`;
  }, []);

  return [id, navigate];
}
