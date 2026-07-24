import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '../../src/components/ThemeToggle';
import { useThemeStore } from '../../src/store/theme';

vi.mock('../../src/api', () => ({
  saveTheme: vi.fn(() => Promise.resolve()),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ theme: 'light' });
  });

  it('renders a toggle button', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toBeDefined();
  });

  it('shows moon icon in light mode', () => {
    useThemeStore.setState({ theme: 'light' });
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    const svg = button.querySelector('svg');
    const path = svg?.querySelector('path');
    expect(path?.getAttribute('d')).toBe('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z');
  });

  it('shows sun icon in dark mode', () => {
    useThemeStore.setState({ theme: 'dark' });
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    const svg = button.querySelector('svg');
    const circle = svg?.querySelector('circle');
    expect(circle?.getAttribute('cx')).toBe('12');
  });

  it('toggles theme on click', () => {
    useThemeStore.setState({ theme: 'light' });
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('shows correct title for current theme', () => {
    useThemeStore.setState({ theme: 'light' });
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button.getAttribute('title')).toBe('Switch to dark mode');
  });
});
