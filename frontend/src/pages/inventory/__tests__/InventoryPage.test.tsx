jest.mock('../../../services/inventoryApi', () => {
  const actual = jest.requireActual('../../../services/inventoryApi');
  return {
    ...actual,
    getInventoryOverview: jest.fn(),
    getItemMaterialDetails: jest.fn(),
    getItems: jest.fn(),
  };
});
// Stub the edit modal so the test can see which row it was opened for
jest.mock('../components/InventoryItemEditModal', () => ({ item, open }: any) =>
  open && item ? <div data-testid="edit-modal">Editing {item.name} at {item.location} (qty {item.quantity})</div> : null);
jest.mock('../components/InventoryItemCreateModal', () => () => null);
jest.mock('../components/InventoryItemIngredientModal', () => () => null);
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryPage from '../InventoryPage';
import * as inventoryApi from '../../../services/inventoryApi';

const widgetAt = (branchId: number, location: string, quantity: number) => ({
  id: '1',
  name: 'Widget',
  sku: 'PAR-1',
  category: 'Parts',
  quantity,
  price: null,
  minStock: 5,
  location,
  branchId,
  status: 'OK',
  productionTime: 42,
  tab: 'parts',
});

describe('InventoryPage', () => {
  beforeEach(() => {
    (inventoryApi.getInventoryOverview as jest.Mock).mockResolvedValue({
      // The same item stocked at two branches
      items: [widgetAt(1, 'Head Office', 12), widgetAt(2, 'Cape Town Plant', 40)],
      previewRows: [],
      alerts: [],
      stats: [],
      tabs: [],
    });

    (inventoryApi.getItemMaterialDetails as jest.Mock).mockResolvedValue({
      itemId: 1,
      itemName: 'Widget',
      category: 'Parts',
      productionTime: 42,
      ingredients: [
        {
          ingredientId: 11,
          name: 'Screw',
          category: 'Hardware',
          requiredQuantity: 2,
          availableQuantity: 1,
          branches: [{ branchName: 'Johannesburg', quantity: 1 }],
        },
      ],
    });

    (inventoryApi.getItems as jest.Mock).mockResolvedValue([
      { ItemID: 1, ItemName: 'Widget', ItemCategory: 'Parts', ProductionTime: 42 },
      { ItemID: 11, ItemName: 'Screw', ItemCategory: 'Hardware', ProductionTime: 0 },
    ]);
  });

  it('renders a row per branch and expands only the clicked row', async () => {
    render(<InventoryPage />);

    expect(screen.getByText(/Inventory Management/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Widget')).toHaveLength(2));

    const viewButtons = screen.getAllByRole('button', { name: /View Widget/i });
    await userEvent.click(viewButtons[1]);

    expect(await screen.findByText('Screw')).toBeInTheDocument();
    expect(viewButtons[1]).toHaveAttribute('aria-expanded', 'true');
    expect(viewButtons[0]).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the edit modal for the clicked branch row, not the first row with that item', async () => {
    render(<InventoryPage />);
    await waitFor(() => expect(screen.getAllByText('Widget')).toHaveLength(2));

    const editButtons = screen.getAllByRole('button', { name: /Edit Widget/i });
    await userEvent.click(editButtons[1]);

    expect(screen.getByTestId('edit-modal')).toHaveTextContent('Editing Widget at Cape Town Plant (qty 40)');
  });
});
