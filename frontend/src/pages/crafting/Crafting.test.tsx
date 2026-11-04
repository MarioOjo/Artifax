import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Crafting from './crafting';
import { useApi } from '../../hooks';
import { getInventoryOverview } from '../../services/inventoryApi';
import { showError, showSuccess } from '../../utils/toast';

jest.mock('../../hooks', () => ({
  useApi: jest.fn(),
  useThemeAwareIcon: (icon: string) => icon,
}));

jest.mock('../../services/inventoryApi', () => ({
  getInventoryOverview: jest.fn(),
}));

jest.mock('../../utils/toast', () => ({
  showSuccess: jest.fn(),
  showError: jest.fn(),
}));

const mockedUseApi = useApi as jest.MockedFunction<typeof useApi>;

// Responses for the calls the page makes when a blueprint is selected
const apiResponses: Record<string, unknown> = {
  '/Item/item/101': { itemID: 101, itemName: 'Round Table', productionTime: 20, itemCategory: 'furniture' },
  '/Item/itemIngredient/item/101': [
    { ingredientID: 201, itemName: 'Iron Ingot', quantity: 10 },
    { ingredientID: 202, itemName: 'Bolt Set (M8)', quantity: 20 },
  ],
  '/Item/item': [
    { itemID: 101, itemName: 'Round Table' },
    { itemID: 201, itemName: 'Iron Ingot' },
    { itemID: 202, itemName: 'Bolt Set (M8)' },
  ],
  '/Item/Branch': [
    { itemID: 101, itemQuantity: 5 },
    { itemID: 201, itemQuantity: 142 },
    { itemID: 202, itemQuantity: 520 },
  ],
};

jest.mock('../../components/layout/AlertStrip', () => ({
  __esModule: true,
  default: ({ label, items }: any) => (
    <div>
      <span>{label}</span>
      <span>{items?.join(',')}</span>
    </div>
  ),
}));

jest.mock('../../components/layout/PageHeader', () => ({
  __esModule: true,
  default: ({ title, subtitle }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

jest.mock('./components/craftingNav/craftingNav', () => ({
  __esModule: true,
  default: ({ onTabChange, onCreateBlueprint }: any) => (
    <div>
      <button onClick={() => onTabChange('history')}>History</button>
      <button onClick={() => onTabChange('craft')}>Craft</button>
      <button onClick={onCreateBlueprint}>Create</button>
    </div>
  ),
}));

jest.mock('./components/stats/stats', () => ({
  __esModule: true,
  default: () => <div>StatsGrid stub</div>,
}));

jest.mock('./components/historyStats/historyStats', () => ({
  __esModule: true,
  default: () => <div>HistoryStats stub</div>,
}));

jest.mock('./components/historyPanel/historyPanel', () => ({
  __esModule: true,
  default: () => <div>HistoryPanel stub</div>,
}));

jest.mock('./components/craftingItems/craftingItems', () => ({
  __esModule: true,
  default: () => <div>CraftingItems stub</div>,
}));

jest.mock('./components/craftingQueue/craftingQueue', () => ({
  __esModule: true,
  default: () => <div>CraftingQueue stub</div>,
}));

jest.mock('./components/craftPanel/craftPanel', () => ({
  __esModule: true,
  default: ({ blueprint, amount, onAmountChange, onCraft }: any) => (
    <div>
      <div>Craft Panel</div>
      <div>{blueprint?.name ?? 'No blueprint selected'}</div>
      <button onClick={() => onAmountChange(amount + 1)}>Increment</button>
      <button onClick={onCraft}>Craft</button>
    </div>
  ),
}));

jest.mock('./components/blueprintPanel/blueprintPanel', () => ({
  __esModule: true,
  default: ({ onSelectBlueprint }: any) => (
    <button onClick={() => onSelectBlueprint('bp-101')}>Select blueprint</button>
  ),
}));

jest.mock('./components/newBlueprint/newBlueprint', () => ({
  __esModule: true,
  default: ({ onCancel }: any) => (
    <div>
      <div>NewBlueprint stub</div>
      <button onClick={onCancel}>Cancel New</button>
    </div>
  ),
}));

describe('Crafting page', () => {
  let api: { get: jest.Mock; post: jest.Mock; put: jest.Mock; delete: jest.Mock };

  beforeEach(() => {
    const get = jest.fn((url: string) =>
      url in apiResponses ? Promise.resolve({ data: apiResponses[url] }) : Promise.reject(new Error(`Unexpected GET ${url}`)));
    api = { get, post: jest.fn(), put: jest.fn(), delete: jest.fn() };
    mockedUseApi.mockReturnValue(api as any);
    (getInventoryOverview as jest.Mock).mockResolvedValue({ alerts: [] });
  });

  it('renders crafting page and switches between tabs', async () => {
    render(<Crafting />);

    expect(screen.getByText(/Crafting Management/i)).toBeInTheDocument();
    expect(screen.getByText(/CraftingItems stub/i)).toBeInTheDocument();

    const buttons = screen.getAllByText('Craft');
    fireEvent.click(buttons[0]);
    expect(screen.getByText(/HistoryStats stub/i)).toBeInTheDocument();
    expect(screen.getByText('Select blueprint')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Select blueprint'));
    await waitFor(() => expect(screen.getByText('Craft Panel')).toBeInTheDocument());
    expect(screen.getByText('Round Table')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Create'));
    expect(screen.getByText(/NewBlueprint stub/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel New'));
    expect(screen.getByText(/CraftingItems stub/i)).toBeInTheDocument();
  });

  it('shows the history tab when selected', () => {
    render(<Crafting />);

    fireEvent.click(screen.getByText('History'));
    expect(screen.getByText(/HistoryPanel stub/i)).toBeInTheDocument();
  });

  const openCraftPanel = async (): Promise<void> => {
    render(<Crafting />);
    fireEvent.click(screen.getAllByText('Craft')[0]);
    fireEvent.click(screen.getByText('Select blueprint'));
    await waitFor(() => expect(screen.getByText('Round Table')).toBeInTheDocument());
  };

  it('places the order and leaves stock changes to the server', async () => {
    api.post.mockResolvedValue({ data: { orderID: 1 } });
    await openCraftPanel();

    fireEvent.click(screen.getAllByText('Craft')[1]);

    await waitFor(() => expect(showSuccess).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/Order/create', expect.objectContaining({ itemID: 101, quantity: 1 }));
    expect(api.put).not.toHaveBeenCalled();
  });

  it('shows which materials are short when the server rejects the order', async () => {
    api.post.mockRejectedValue({
      response: {
        status: 409,
        data: { message: 'Not enough materials at this branch.', shortages: [{ itemName: 'Iron Ingot', required: 10, available: 4 }] },
      },
    });
    await openCraftPanel();

    fireEvent.click(screen.getAllByText('Craft')[1]);

    await waitFor(() => expect(showError).toHaveBeenCalledWith(expect.stringContaining('Iron Ingot: need 10, have 4')));
    expect(api.put).not.toHaveBeenCalled();
  });
});
