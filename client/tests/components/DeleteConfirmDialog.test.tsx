import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DeleteConfirmDialog from '../../src/components/DeleteConfirmDialog';

describe('DeleteConfirmDialog', () => {
  it('shows the title', () => {
    render(
      <DeleteConfirmDialog title="My Page" hasChildren={false} onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(screen.getByText(/My Page/)).toBeDefined();
  });

  it('shows children warning when hasChildren', () => {
    render(
      <DeleteConfirmDialog title="My Page" hasChildren={true} onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(screen.getByText(/sub-pages/)).toBeDefined();
  });

  it('calls onConfirm when delete clicked', () => {
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmDialog title="My Page" hasChildren={false} onConfirm={onConfirm} onCancel={() => {}} />
    );
    fireEvent.click(screen.getByText('Delete'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel clicked', () => {
    const onCancel = vi.fn();
    render(
      <DeleteConfirmDialog title="My Page" hasChildren={false} onConfirm={() => {}} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});
