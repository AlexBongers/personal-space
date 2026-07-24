import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../../src/store/theme';

describe('Theme store', () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ theme: 'light' });
  });

  it('defaults to light theme', () => {
    const { theme } = useThemeStore.getState();
    expect(theme).toBe('light');
  });

  it('toggles to dark theme', () => {
    useThemeStore.getState().toggleTheme();
    const { theme } = useThemeStore.getState();
    expect(theme).toBe('dark');
  });

  it('persists theme to localStorage', () => {
    useThemeStore.getState().toggleTheme();
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('toggles back to light', () => {
    useThemeStore.getState().toggleTheme();
    useThemeStore.getState().toggleTheme();
    const { theme } = useThemeStore.getState();
    expect(theme).toBe('light');
  });
});