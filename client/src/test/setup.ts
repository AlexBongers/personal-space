import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom implements neither of these, and both are fire-and-forget in the app.
Element.prototype.scrollIntoView = vi.fn();
document.execCommand = vi.fn();

afterEach(() => {
  cleanup();
  localStorage.clear();
});
