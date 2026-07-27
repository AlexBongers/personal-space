import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDebounced, useHashRoute, useStored, useTheme } from './hooks.ts';

describe('useStored', () => {
  it('starts from the fallback and writes changes to localStorage', () => {
    const { result } = renderHook(() => useStored('k', 'a'));
    expect(result.current[0]).toBe('a');
    act(() => result.current[1]('b'));
    expect(result.current[0]).toBe('b');
    expect(localStorage.getItem('k')).toBe('"b"');
  });

  it('reads an existing value back', () => {
    localStorage.setItem('k', JSON.stringify(['x']));
    expect(renderHook(() => useStored<string[]>('k', [])).result.current[0]).toEqual(['x']);
  });

  it('falls back when the stored value is not valid JSON', () => {
    localStorage.setItem('k', '{oops');
    expect(renderHook(() => useStored('k', 'fallback')).result.current[0]).toBe('fallback');
  });
});

describe('useTheme', () => {
  it('defaults to light and applies it to the document', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('toggles, applies and remembers the choice', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current[1]());
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('ps.theme')).toBe('"dark"');

    act(() => result.current[1]());
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('restores a remembered theme on load', () => {
    localStorage.setItem('ps.theme', '"dark"');
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('useDebounced', () => {
  it('runs once after the caller goes quiet', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const { result } = renderHook(() => useDebounced(fn, 100));

    act(() => {
      result.current('a');
      result.current('b');
      result.current('c');
    });
    expect(fn).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(120));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
    vi.useRealTimers();
  });
});

describe('useHashRoute', () => {
  it('reads the page id from the hash and navigates', () => {
    window.location.hash = '#/p/pg_1';
    const { result } = renderHook(() => useHashRoute());
    expect(result.current[0]).toBe('pg_1');

    act(() => result.current[1]('pg_2'));
    expect(window.location.hash).toBe('#/p/pg_2');
  });

  it('is null without a page in the hash', () => {
    window.location.hash = '';
    expect(renderHook(() => useHashRoute()).result.current[0]).toBeNull();
  });
});
