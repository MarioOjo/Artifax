import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DashboardPage from '../DashboardPage';
import * as inventoryApi from '../../../services/inventoryApi';
import { getCraftingQueue } from '../../../services/orderApi';

jest.mock('../../../services/orderApi', () => ({
  getCraftingQueue: jest.fn(),
}));

jest.mock('../../../services/inventoryApi', () => {
  const actual = jest.requireActual('../../../services/inventoryApi');
  return {
    ...actual,
    getInventoryItems: jest.fn(),
  };
});

describe('DashboardPage', () => {
  beforeEach(() => {
    (getCraftingQueue as jest.Mock).mockResolvedValue({ activeItems: [], queuedItems: [] });
  });

  it('shows a loading state for jobs until they arrive, then the empty state', async () => {
    (inventoryApi.getInventoryItems as jest.Mock).mockResolvedValue([]);
    let resolveQueue: (value: unknown) => void = () => {};
    (getCraftingQueue as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveQueue = resolve; }));

    render(<DashboardPage />);

    expect(screen.getAllByText('Loading jobs...')).toHaveLength(2);
    expect(screen.queryByText('No active jobs')).not.toBeInTheDocument();

    resolveQueue({ activeItems: [], queuedItems: [] });

    expect(await screen.findByText('No active jobs')).toBeInTheDocument();
    expect(screen.getByText('No queued jobs')).toBeInTheDocument();
    expect(screen.queryByText('Loading jobs...')).not.toBeInTheDocument();
  });

  it('shows a load error with Retry when inventory fails to load', async () => {
    (inventoryApi.getInventoryItems as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

    render(<DashboardPage />);

    expect(await screen.findByText(/Couldn't load inventory/i)).toBeInTheDocument();
    expect(screen.queryByText(/No live inventory rows/i)).not.toBeInTheDocument();

    (inventoryApi.getInventoryItems as jest.Mock).mockResolvedValueOnce([
      { id: 1, name: 'Retried Item', sku: 'R-1', category: 'Testing', quantity: 3, minStock: 1, location: 'Zone R', status: 'OK', tab: 'testing' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Retried Item')).toBeInTheDocument();
  });

  it('renders preview rows from API', async () => {
    (inventoryApi.getInventoryItems as jest.Mock).mockResolvedValue([
      {
        id: 1,
        name: 'Test Item',
        sku: 'TES-1',
        category: 'Testing',
        quantity: 42,
        minStock: 5,
        location: 'Zone Test',
        status: 'OK',
        tab: 'testing',
      },
    ]);

    render(<DashboardPage />);

    // Header loads immediately
    expect(screen.getByText(/Inventory & Crafting/i)).toBeInTheDocument();

    // Wait for API data to render
    await waitFor(() => expect(screen.getByText('Test Item')).toBeInTheDocument());
    expect(screen.getByText('Zone Test')).toBeInTheDocument();
  });
});
