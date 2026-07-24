import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DatabaseView from '../../src/components/DatabaseView';

const mockAddProperty = vi.fn();
const mockDeleteProperty = vi.fn();
const mockUpdateProperty = vi.fn();
const mockAddRow = vi.fn();
const mockDeleteRow = vi.fn();
const mockUpdateRow = vi.fn();
const mockBatchUpdateCells = vi.fn();
const mockFetchViewSettings = vi.fn().mockResolvedValue({});
const mockSaveViewSettings = vi.fn();
const mockFetchPage = vi.fn();
const mockFetchDatabase = vi.fn();

vi.mock('../../src/api', () => ({
  fetchDatabase: ((...args: any[]) => mockFetchDatabase(...args)),
  fetchPage: ((...args: any[]) => mockFetchPage(...args)),
  addProperty: ((...args: any[]) => mockAddProperty(...args)),
  deleteProperty: ((...args: any[]) => mockDeleteProperty(...args)),
  updateProperty: ((...args: any[]) => mockUpdateProperty(...args)),
  addRow: ((...args: any[]) => mockAddRow(...args)),
  deleteRow: ((...args: any[]) => mockDeleteRow(...args)),
  updateRow: ((...args: any[]) => mockUpdateRow(...args)),
  batchUpdateCells: ((...args: any[]) => mockBatchUpdateCells(...args)),
  fetchViewSettings: ((...args: any[]) => mockFetchViewSettings(...args)),
  saveViewSettings: ((...args: any[]) => mockSaveViewSettings(...args)),
}));

const mockPageData = {
  page: { id: 'db1', parent_id: null, title: 'Test DB', icon: 'db', type: 'database', content: null, created_at: '', updated_at: '', children: [] },
  properties: [{ id: 'p1', database_id: 'db1', name: 'Status', type: 'select', position: 0, options: [{ id: 'o1', label: 'Active', color: 'blue' }] }],
  rows: [{ id: 'r1', database_id: 'db1', title: 'Item 1', position: 0, created_at: '', updated_at: '' }],
  cells: { r1: { p1: '"o1"' } },
};

describe('DatabaseView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchDatabase.mockResolvedValue(mockPageData);
    mockFetchPage.mockResolvedValue(mockPageData.page);
    mockFetchViewSettings.mockResolvedValue({});
  });

  it('shows loading state initially', () => {
    render(
      <BrowserRouter>
        <DatabaseView pageId="db1" />
      </BrowserRouter>
    );
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('renders properties bar after loading', async () => {
    render(
      <BrowserRouter>
        <DatabaseView pageId="db1" />
      </BrowserRouter>
    );
    const statusElements = await screen.findAllByText('Status');
    expect(statusElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows add property button', async () => {
    render(
      <BrowserRouter>
        <DatabaseView pageId="db1" />
      </BrowserRouter>
    );
    expect(await screen.findByText('+ Add property')).toBeDefined();
  });

  it('renders database title', async () => {
    render(
      <BrowserRouter>
        <DatabaseView pageId="db1" />
      </BrowserRouter>
    );
    expect(await screen.findByText('Test DB')).toBeDefined();
  });

  it('renders view switcher', async () => {
    render(
      <BrowserRouter>
        <DatabaseView pageId="db1" />
      </BrowserRouter>
    );
    expect(await screen.findByText('Table')).toBeDefined();
  });

  it('shows properties label', async () => {
    render(
      <BrowserRouter>
        <DatabaseView pageId="db1" />
      </BrowserRouter>
    );
    expect(await screen.findByText('Properties')).toBeDefined();
  });

  it('shows add property form when clicking + Add property', async () => {
    render(
      <BrowserRouter>
        <DatabaseView pageId="db1" />
      </BrowserRouter>
    );
    const addButton = await screen.findByText('+ Add property');
    fireEvent.click(addButton);
    expect(await screen.findByPlaceholderText('Property name')).toBeDefined();
  });

  it('calls addProperty when submitting new property', async () => {
    mockAddProperty.mockResolvedValue({ id: 'p2', database_id: 'db1', name: 'New Prop', type: 'text', position: 1, options: [] });
    render(
      <BrowserRouter>
        <DatabaseView pageId="db1" />
      </BrowserRouter>
    );
    const addButton = await screen.findByText('+ Add property');
    fireEvent.click(addButton);
    const input = await screen.findByPlaceholderText('Property name');
    fireEvent.change(input, { target: { value: 'New Prop' } });
    const confirmButton = screen.getByText('Add');
    fireEvent.click(confirmButton);
    expect(mockAddProperty).toHaveBeenCalledWith('db1', { name: 'New Prop', type: 'text' });
  });

  it('calls deleteProperty when clicking × on a property', async () => {
    render(
      <BrowserRouter>
        <DatabaseView pageId="db1" />
      </BrowserRouter>
    );
    const deleteButtons = await screen.findAllByTitle('Delete property');
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(deleteButtons[0]);
    expect(mockDeleteProperty).toHaveBeenCalledWith('p1');
  });

  it('shows table view with rows after loading', async () => {
    render(
      <BrowserRouter>
        <DatabaseView pageId="db1" />
      </BrowserRouter>
    );
    expect(await screen.findByText('Item 1')).toBeDefined();
  });

  it('shows board view when switching to board', async () => {
    render(
      <BrowserRouter>
        <DatabaseView pageId="db1" />
      </BrowserRouter>
    );
    const boardButton = await screen.findByText('Board');
    fireEvent.click(boardButton);
    expect(await screen.findByText('No value')).toBeDefined();
  });

  it('shows list view when switching to list', async () => {
    render(
      <BrowserRouter>
        <DatabaseView pageId="db1" />
      </BrowserRouter>
    );
    const listButton = await screen.findByText('List');
    fireEvent.click(listButton);
    expect(await screen.findByText('Item 1')).toBeDefined();
  });
});
