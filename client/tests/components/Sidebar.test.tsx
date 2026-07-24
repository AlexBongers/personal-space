import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Sidebar from '../../src/components/Sidebar';

describe('Sidebar', () => {
  it('renders loading state', () => {
    render(
      <BrowserRouter>
        <Sidebar pages={[]} loading={true} />
      </BrowserRouter>
    );
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('renders pages', () => {
    const pages = [
      { id: '1', parent_id: null, title: 'Test Page', icon: '📄', type: 'page' as const, children: [], created_at: '', updated_at: '' },
    ];
    render(
      <BrowserRouter>
        <Sidebar pages={pages} loading={false} />
      </BrowserRouter>
    );
    expect(screen.getByText('Test Page')).toBeDefined();
  });
});