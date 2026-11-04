import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BlueprintPanel from './blueprintPanel';
import { useApi } from '../../../../hooks';

jest.mock('../../../../hooks', () => ({
  useApi: jest.fn(),
  useThemeAwareIcon: (icon: string) => icon,
}));

const mockBlueprintsResponse = [
  {
    itemID: 1,
    itemName: 'Pot',
    itemCategory: 'metal',
    productionTime: 10,
    ingredients: [
      { ingredientID: 101, itemName: 'Iron Ingot', quantity: 2 }
    ]
  },
  {
    itemID: 2,
    itemName: 'Table',
    itemCategory: 'other',
    productionTime: 20,
  }
];

const mockItemsResponse = [
  { itemID: 101, itemName: 'Iron Ingot' }
];

const mockBranchResponse = [
  { itemID: 101, itemQuantity: 5 }
];

const mockUseApi = useApi as jest.Mock;

const createApiMock = (handler: (url: string) => Promise<any>) => {
  const get = jest.fn((url: string) => handler(url));
  mockUseApi.mockReturnValue({ get });
  return get;
};

describe('BlueprintPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders blueprint cards and auto-selects the first blueprint', async () => {
    const handleSelectBlueprint = jest.fn();
    const handleFilterChange = jest.fn();
    const handleCreateBlueprint = jest.fn();

    const getMock = createApiMock((url) => {
      if (url === '/Item/item/allItemBlueprints') {
        return Promise.resolve({ data: mockBlueprintsResponse });
      }
      if (url === '/Item/item') {
        return Promise.resolve({ data: mockItemsResponse });
      }
      if (url === '/Item/Branch') {
        return Promise.resolve({ data: mockBranchResponse });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(
      <BlueprintPanel
        selectedBlueprintId=""
        filter="all"
        onFilterChange={handleFilterChange}
        onSelectBlueprint={handleSelectBlueprint}
        onCreateBlueprint={handleCreateBlueprint}
      />
    );

    expect(getMock).toHaveBeenCalledWith('/Item/item/allItemBlueprints');

    await waitFor(() => expect(screen.getByRole('button', { name: /Pot/i })).toBeInTheDocument());

    const potCard = screen.getByRole('button', { name: /Pot/i });
    expect(within(potCard).getByText('0')).toBeInTheDocument();
    expect(within(potCard).getByText('2')).toBeInTheDocument();
    expect(handleSelectBlueprint).toHaveBeenCalledWith('bp-1');
    expect(screen.queryByText(/Loading blueprints.../i)).not.toBeInTheDocument();
  });

  it('filters blueprints by category and forwards filter changes', async () => {
    const handleSelectBlueprint = jest.fn();
    const handleFilterChange = jest.fn();
    const handleCreateBlueprint = jest.fn();

    createApiMock((url) => {
      if (url === '/Item/item/allItemBlueprints') {
        return Promise.resolve({ data: mockBlueprintsResponse });
      }
      if (url === '/Item/item') {
        return Promise.resolve({ data: mockItemsResponse });
      }
      if (url === '/Item/Branch') {
        return Promise.resolve({ data: mockBranchResponse });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(
      <BlueprintPanel
        selectedBlueprintId="bp-1"
        filter="metal"
        onFilterChange={handleFilterChange}
        onSelectBlueprint={handleSelectBlueprint}
        onCreateBlueprint={handleCreateBlueprint}
      />
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /Pot/i })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Table/i })).not.toBeInTheDocument();

    const filterButton = screen.getByRole('button', { name: /Blueprint filter/i });
    await userEvent.click(filterButton);
    await userEvent.click(screen.getByRole('option', { name: /Other/i }));

    expect(handleFilterChange).toHaveBeenCalledWith('other');
  });

  it('shows an error message when blueprint fetching fails', async () => {
    const handleSelectBlueprint = jest.fn();
    const handleFilterChange = jest.fn();
    const handleCreateBlueprint = jest.fn();

    createApiMock((url) => {
      if (url === '/Item/item/allItemBlueprints') {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <BlueprintPanel
        selectedBlueprintId=""
        filter="all"
        onFilterChange={handleFilterChange}
        onSelectBlueprint={handleSelectBlueprint}
        onCreateBlueprint={handleCreateBlueprint}
      />
    );

    await waitFor(() => expect(screen.getByText(/Error: Network error/i)).toBeInTheDocument());
    expect(screen.queryByText(/Loading blueprints.../i)).not.toBeInTheDocument();
  });

  it('calls the create blueprint callback when the New Blueprint button is clicked', async () => {
    const handleSelectBlueprint = jest.fn();
    const handleFilterChange = jest.fn();
    const handleCreateBlueprint = jest.fn();

    createApiMock((url) => {
      if (url === '/Item/item/allItemBlueprints') {
        return Promise.resolve({ data: mockBlueprintsResponse });
      }
      if (url === '/Item/item') {
        return Promise.resolve({ data: mockItemsResponse });
      }
      if (url === '/Item/Branch') {
        return Promise.resolve({ data: mockBranchResponse });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(
      <BlueprintPanel
        selectedBlueprintId="bp-1"
        filter="all"
        onFilterChange={handleFilterChange}
        onSelectBlueprint={handleSelectBlueprint}
        onCreateBlueprint={handleCreateBlueprint}
      />
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /Pot/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /New Blueprint/i }));

    expect(handleCreateBlueprint).toHaveBeenCalledTimes(1);
  });
});
