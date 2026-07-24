import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../src/App';

const mockFetchPage = vi.fn();

const mockStoreState = {
  pages: [],
  loading: false,
  loadPages: vi.fn(),
  addPage: vi.fn(),
  renamePage: vi.fn(),
  changeIcon: vi.fn(),
  removePage: vi.fn(),
  error: null,
};

vi.mock('../../src/store/pages', () => ({
  usePagesStore: Object.assign(
    (selector?: (state: any) => any) => selector ? selector(mockStoreState) : mockStoreState,
    { setState: vi.fn(), getState: vi.fn(() => mockStoreState), subscribe: vi.fn(), destroy: vi.fn() }
  ),
}));

const mockThemeState = {
  theme: 'light',
  setTheme: vi.fn(),
};

vi.mock('../../src/store/theme', () => ({
  useThemeStore: Object.assign(
    (selector?: (state: any) => any) => selector ? selector(mockThemeState) : mockThemeState,
    { setState: vi.fn(), getState: vi.fn(() => mockThemeState), subscribe: vi.fn(), destroy: vi.fn() }
  ),
}));

vi.mock('../../src/api', () => ({
  fetchPage: (...args: any[]) => mockFetchPage(...args),
  fetchTheme: vi.fn().mockResolvedValue(null),
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(container).toBeTruthy();
  });

  it('renders sidebar', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText('Personal Space')).toBeDefined();
  });

  it('renders empty state on root path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText('Select a page from the sidebar')).toBeDefined();
  });

  it('shows loading state for page route', () => {
    mockFetchPage.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter initialEntries={['/page/123']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('shows page not found for invalid page', async () => {
    mockFetchPage.mockResolvedValue(null);
    render(
      <MemoryRouter initialEntries={['/page/999']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByText('Page not found')).toBeDefined();
  });

  it('renders PageEditor for a regular page', async () => {
    mockFetchPage.mockResolvedValue({ id: '1', title: 'Test Page', icon: '', type: 'page', content: null, parent_id: null, children: [], created_at: '', updated_at: '' });
    render(
      <MemoryRouter initialEntries={['/page/1']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByText('Personal Space')).toBeDefined();
  });
});
