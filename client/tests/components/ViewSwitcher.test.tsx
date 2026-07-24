import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewSwitcher from '../../src/components/ViewSwitcher';

describe('ViewSwitcher', () => {
  it('renders three view tabs', () => {
    render(<ViewSwitcher activeView="table" onViewChange={() => {}} />);
    expect(screen.getByText('Table')).toBeDefined();
    expect(screen.getByText('Board')).toBeDefined();
    expect(screen.getByText('List')).toBeDefined();
  });

  it('highlights the active tab', () => {
    render(<ViewSwitcher activeView="board" onViewChange={() => {}} />);
    const boardButton = screen.getByText('Board');
    expect(boardButton.style.fontWeight).toBe('600');
    const tableButton = screen.getByText('Table');
    expect(tableButton.style.fontWeight).toBe('400');
  });

  it('calls onViewChange when a tab is clicked', () => {
    const onViewChange = vi.fn();
    render(<ViewSwitcher activeView="table" onViewChange={onViewChange} />);
    fireEvent.click(screen.getByText('Board'));
    expect(onViewChange).toHaveBeenCalledWith('board');
  });
});
