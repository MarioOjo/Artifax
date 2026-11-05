import { getInventoryItems, getItemMaterialDetails, getItemCategoryOptions, buildInventoryOverview, InventoryItem } from '../inventoryApi';
import { api } from '../../hooks/useApi';

jest.mock('../../hooks/useApi', () => ({
  api: { get: jest.fn() },
}));

const mockedGet = api.get as jest.Mock;

// Routes GET requests by URL; anything unexpected responds like a 404 from the API
const mockGet = (routes: Record<string, unknown>): void => {
  mockedGet.mockImplementation((url: string) =>
    url in routes
      ? Promise.resolve({ data: routes[url] })
      : Promise.reject(Object.assign(new Error('Not Found'), { isAxiosError: true, response: { status: 404, statusText: 'Not Found' } })));
};

const row = (id: number, name: string, category: string, quantity: number, branchId: number, branchName: string) => ({
  inventoryItemId: id,
  inventoryItemName: name,
  inventoryItemCategory: category,
  inventoryItemProductionTime: 0,
  inventoryItemQuantity: quantity,
  inventoryItemBranchName: branchName,
  inventoryItemBranchId: branchId,
});

test('getInventoryItems returns one row per item and branch, flagging low stock', async () => {
  mockGet({
    'Item/item/allInventoryItems': [
      row(1, 'Widget', 'Tools', 2, 1, 'Branch A'),
      row(1, 'Widget', 'Tools', 30, 2, 'Branch B'),
      row(2, 'Gadget', 'Electronics', 10, 1, 'Branch A'),
    ],
  });

  const items = await getInventoryItems();

  const widgets = items.filter((i) => i.id === '1');
  expect(widgets.map((w) => [w.location, w.branchId, w.quantity, w.status])).toEqual([
    ['Branch A', 1, 2, 'LOW'],
    ['Branch B', 2, 30, 'OK'],
  ]);
  expect(items.find((i) => i.id === '2')).toMatchObject({ quantity: 10, location: 'Branch A', status: 'OK' });
});

test('getItemMaterialDetails totals each ingredient across branches', async () => {
  mockGet({
    'Item/item/42': { itemID: 42, itemName: 'Sample Item', itemCategory: 'Misc', productionTime: 2 },
    'Item/itemIngredient/item/42': [
      { ingredientID: 101, itemName: 'Part A', itemCategory: 'Metal', quantity: 2 },
      { ingredientID: 102, itemName: 'Part B', itemCategory: 'Plastic', quantity: 1 },
    ],
    'Item/item/allInventoryItems': [
      row(101, 'Part A', 'Metal', 3, 1, 'Branch X'),
      row(101, 'Part A', 'Metal', 1, 2, 'Branch Y'),
      row(102, 'Part B', 'Plastic', 0, 1, 'Branch X'),
    ],
  });

  const details = await getItemMaterialDetails(42);

  expect(details).toMatchObject({ itemId: 42, itemName: 'Sample Item', productionTime: 2 });
  expect(details!.ingredients).toHaveLength(2);
  const partA = details!.ingredients.find((ing) => ing.ingredientId === 101);
  expect(partA!.availableQuantity).toBe(4);
  expect(partA!.branches).toEqual([
    { branchName: 'Branch X', quantity: 3 },
    { branchName: 'Branch Y', quantity: 1 },
  ]);
});

test('getItemMaterialDetails returns null for a missing item', async () => {
  mockGet({ 'Item/item/allInventoryItems': [] });

  expect(await getItemMaterialDetails(999)).toBeNull();
});

describe('getItemCategoryOptions', () => {
  it('deduplicates, trims, filters blanks, and sorts categories', () => {
    const items = [
      { ItemCategory: 'Furniture' },
      { ItemCategory: '  Metals  ' },
      { ItemCategory: 'Furniture' },
      { ItemCategory: '' },
      { ItemCategory: '   ' },
    ] as Parameters<typeof getItemCategoryOptions>[0];

    expect(getItemCategoryOptions(items)).toEqual(['Furniture', 'Metals']);
  });
});

test('buildInventoryOverview only has tabs for categories in stock and names the branch in alerts', () => {
  const item = (id: string, name: string, category: string, quantity: number, location: string): InventoryItem => ({
    id, name, sku: '', category, quantity, price: null, minStock: 5, location, branchId: 1,
    status: quantity < 5 ? 'LOW' : 'OK', productionTime: 0, tab: category.toLowerCase(),
  } as InventoryItem);

  const overview = buildInventoryOverview([
    item('1', 'Bolt', 'Metal', 50, 'Head Office'),
    item('2', 'Gear', 'mechanical', 2, 'Cape Town Plant'),
  ]);

  expect(overview.tabs.map((tab) => tab.label)).toEqual(['All (2)', 'Metals (1)', 'Mechanical (1)']);
  expect(overview.stats.find((stat) => stat.id === 'categories')?.value).toBe(2);
  expect(overview.alerts).toEqual(['Gear · Cape Town Plant (2 remaining)']);
});
