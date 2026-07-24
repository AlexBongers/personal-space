import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SlashMenu from '../../src/components/SlashMenu';
import { ITEMS } from '../../src/components/SlashMenu';

describe('SlashMenu', () => {
  const position = { x: 100, y: 200 };

  it('renders items', () => {
    render(
      <SlashMenu items={ITEMS} selectedIndex={0} onSelect={() => {}} onClose={() => {}} position={position} />
    );
    expect(screen.getByText('Text')).toBeDefined();
    expect(screen.getByText('Heading 1')).toBeDefined();
  });

  it('shows "No results" for empty query', () => {
    render(
      <SlashMenu items={[]} selectedIndex={0} onSelect={() => {}} onClose={() => {}} position={position} />
    );
    expect(screen.getByText('No results')).toBeDefined();
  });

  it('calls onSelect when item clicked', () => {
    const onSelect = vi.fn();
    render(
      <SlashMenu items={ITEMS} selectedIndex={0} onSelect={onSelect} onClose={() => {}} position={position} />
    );
    fireEvent.click(screen.getByText('Text'));
    expect(onSelect).toHaveBeenCalledWith(0);
  });
});
