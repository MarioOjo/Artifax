import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import CraftingQueue from './craftingQueue';
import { useApi } from '../../../../hooks';

jest.mock('../../../../hooks', () => ({
  useApi: jest.fn(),
  useThemeAwareIcon: (icon: string) => icon,
}));

const mockedUseApi = useApi as jest.MockedFunction<typeof useApi>;
const mockApi = { get: jest.fn(), put: jest.fn() };

const employees = [
  { employeeId: 1, employeeName: 'Alice' },
  { employeeId: 2, employeeName: 'Bob' },
  { employeeId: 3, employeeName: 'Charlie' },
  { employeeId: 4, employeeName: 'Dana' },
];

const mockBackend = (orders: unknown[]): void => {
  mockApi.get.mockImplementation((url: string) => {
    if (url.endsWith('/Order')) return Promise.resolve({ data: orders });
    if (url.endsWith('/User')) return Promise.resolve({ data: employees });
    if (url.endsWith('/Branch')) return Promise.resolve({ data: [{ branchID: 1, branchName: 'Head Office' }] });
    return Promise.reject(new Error('Unknown URL'));
  });
};

const order = (orderID: number, itemName: string, quantity: number, status: string) => ({
  orderID,
  itemID: 100 + orderID,
  itemName,
  quantity,
  createdDateTime: `2025-01-01T0${orderID}:00:00Z`,
  totalTime: 100,
  timeElapsed: 20,
  status,
  branchID: 1,
  employeeID: orderID,
});

describe('CraftingQueue', () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockedUseApi.mockReturnValue(mockApi as any);
  });

  it('lists active and paused crafts but counts only active ones against the limit', async () => {
    mockBackend([order(1, 'Item A', 2, 'Active'), order(2, 'Item B', 1, 'Paused'), order(3, 'Item C', 4, 'Active')]);

    render(<CraftingQueue />);

    await waitFor(() => {
      expect(screen.getByText(/Item A x2/i)).toBeInTheDocument();
      expect(screen.getByText(/Item B x1/i)).toBeInTheDocument();
      expect(screen.getByText(/Item C x4/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/2 \/ 3/)).toBeInTheDocument();
  });

  it('shows 3 / 3 when three orders are active, even with a paused order listed', async () => {
    mockBackend([
      order(1, 'Item A', 2, 'Active'),
      order(2, 'Item B', 1, 'Paused'),
      order(3, 'Item C', 4, 'Active'),
      order(4, 'Item D', 1, 'Active'),
    ]);

    render(<CraftingQueue />);

    await waitFor(() => {
      expect(screen.getByText(/3 \/ 3/)).toBeInTheDocument();
      expect(screen.getByText(/Item D x1/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Item B x1/i)).toBeInTheDocument();
  });

  it('lists queued orders on the next page', async () => {
    mockBackend([order(1, 'Item A', 2, 'Active'), order(2, 'Item Q', 3, 'Queued')]);

    render(<CraftingQueue />);

    await waitFor(() => expect(screen.getByText(/Item A x2/i)).toBeInTheDocument());
    expect(screen.queryByText(/Item Q x3/i)).not.toBeInTheDocument();

    screen.getByRole('button', { name: /Next/i }).click();
    expect(await screen.findByText(/Item Q x3/i)).toBeInTheDocument();
  });
});
