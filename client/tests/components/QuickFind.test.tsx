import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import QuickFind from '../../src/components/QuickFind';

vi.mock('../../src/api', () => ({
  search: vi.fn().mockResolvedValue([
    { id: '1', title: 'Test Page', icon: '📄', type: 'page' },
  ]),
}));

describe('QuickFind', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <BrowserRouter>
        <QuickFind open={false} onClose={() => {}} />
      </BrowserRouter>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders when open', () => {
    render(
      <BrowserRouter>
        <QuickFind open={true} onClose={() => {}} />
      </BrowserRouter>
    );
    expect(screen.getByPlaceholderText('Search pages, databases, rows...')).toBeDefined();
  });

  it('has search input', () => {
    render(
      <BrowserRouter>
        <QuickFind open={true} onClose={() => {}} />
      </BrowserRouter>
    );
    const input = screen.getByPlaceholderText('Search pages, databases, rows...');
    expect(input).toBeDefined();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter>
        <QuickFind open={true} onClose={onClose} />
      </BrowserRouter>
    );
    const input = screen.getByPlaceholderText('Search pages, databases, rows...');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalled();
  });
});
