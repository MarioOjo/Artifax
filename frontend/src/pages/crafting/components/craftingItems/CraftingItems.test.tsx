import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CraftingItems from './craftingItems';
import { useApi } from '../../../../hooks';
import { showError } from '../../../../utils/toast';

jest.mock('../../../../hooks', () => ({
  useApi: jest.fn(),
  useThemeAwareIcon: (icon: string) => icon,
}));

// Signed-in user for each test; null (no session) unless a test sets it
let mockCurrentUser: { name: string; role: string; branchId?: number } | null = null;
jest.mock('../../../../utils/currentUser', () => ({
  useCurrentUser: () => mockCurrentUser,
}));

jest.mock('../../../../utils/toast', () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
}));

const mockedUseApi = useApi as jest.MockedFunction<typeof useApi>;
const mockApi = { get: jest.fn(), put: jest.fn() };

// One active order, enough to render a job card with its controls
const singleActiveOrder = (url: string) => {
  if (url.endsWith('/Order')) {
    return Promise.resolve({ data: [
      { orderID: 1, itemID: 101, itemName: 'Circuit Board A1', quantity: 2, createdDateTime: '2025-01-01T08:00:00Z', totalTime: 120, timeElapsed: 15, status: 'Active', employeeID: 1 },
    ] });
  }
  if (url.endsWith('/User')) return Promise.resolve({ data: [{ employeeId: 1, employeeName: 'Alice' }] });
  if (url.endsWith('/Branch')) return Promise.resolve({ data: [{ branchID: 1, branchName: 'Head Office' }] });
  if (url.includes('/Item/itemIngredient/item/')) return Promise.resolve({ data: [] });
  return Promise.reject(new Error('Unknown URL'));
};

describe('CraftingItems', () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.put.mockReset();
    mockedUseApi.mockReturnValue(mockApi as any);
    mockCurrentUser = null;
    (showError as jest.Mock).mockReset();
  });

  it('shows the server reason when pausing an order fails', async () => {
    mockApi.get.mockImplementation(singleActiveOrder);
    mockApi.put.mockRejectedValue(Object.assign(new Error('Request failed with status code 409'), {
      isAxiosError: true,
      response: { status: 409, data: { message: 'This order has already finished.' } },
    }));

    render(<CraftingItems />);

    fireEvent.click(await screen.findByRole('button', { name: /Pause/i }));

    await waitFor(() => expect(showError).toHaveBeenCalledWith('This order has already finished.'));
  });

  it('disables order controls for the read-only demo account', async () => {
    mockCurrentUser = { name: 'Demo', role: 'Demo' };
    mockApi.get.mockImplementation(singleActiveOrder);

    render(<CraftingItems />);

    expect(await screen.findByRole('button', { name: /Pause/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Order Expedite/i })).toBeDisabled();
  });

  it('shows a load error with Retry instead of "No active jobs" when loading fails', async () => {
    mockApi.get.mockRejectedValue(new Error('Network Error'));

    render(<CraftingItems />);

    expect(await screen.findByText(/Couldn't load active jobs/i)).toBeInTheDocument();
    expect(screen.queryByText(/No active jobs available/i)).not.toBeInTheDocument();

    mockApi.get.mockImplementation(singleActiveOrder);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText(/Circuit Board A1/i)).toBeInTheDocument();
  });

  it('renders active crafting jobs and action buttons from backend orders', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url.endsWith('/Order')) {
        return Promise.resolve({ data: [
          { orderID: 1, itemID: 101, itemName: 'Circuit Board A1', quantity: 2, createdDateTime: '2025-01-01T08:00:00Z', totalTime: 120, timeElapsed: 15, status: 'Active', employeeID: 1 },
          { orderID: 2, itemID: 102, itemName: 'Gear Assembly', quantity: 1, createdDateTime: '2025-01-01T09:00:00Z', totalTime: 80, timeElapsed: 10, status: 'Paused', employeeID: 2 },
          { orderID: 3, itemID: 103, itemName: 'Packaging Unit', quantity: 4, createdDateTime: '2025-01-01T10:00:00Z', totalTime: 90, timeElapsed: 45, status: 'Active', employeeID: 3 },
        ] });
      }

      if (url.endsWith('/User')) {
        return Promise.resolve({ data: [
          { employeeId: 1, employeeName: 'Alice' },
          { employeeId: 2, employeeName: 'Bob' },
          { employeeId: 3, employeeName: 'Charlie' },
        ] });
      }

      if (url.endsWith('/Branch')) {
        return Promise.resolve({ data: [{ branchID: 1, branchName: 'Head Office' }] });
      }
      if (url.includes('/Item/itemIngredient/item/')) {
        return Promise.resolve({ data: [
          { itemID: 201, itemName: 'Metal Plate', quantity: 2 },
          { itemID: 202, itemName: 'Screw', quantity: 4 },
        ] });
      }

      return Promise.reject(new Error('Unknown URL'));
    });

    mockApi.put.mockResolvedValue({});

    render(<CraftingItems />);

    await waitFor(() => {
      expect(screen.getByText(/Circuit Board A1/i)).toBeInTheDocument();
      expect(screen.getByText(/Gear Assembly/i)).toBeInTheDocument();
      expect(screen.getByText(/Packaging Unit/i)).toBeInTheDocument();
    });

    expect(screen.getAllByRole('button', { name: /Cancel/i })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /Pause/i })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument();
  });

  it('updates card transform when the mouse moves and resets on leave', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url.endsWith('/Order')) {
        return Promise.resolve({ data: [
          { orderID: 1, itemID: 101, itemName: 'Circuit Board A1', quantity: 2, createdDateTime: '2025-01-01T08:00:00Z', totalTime: 120, timeElapsed: 15, status: 'Active', employeeID: 1 },
        ] });
      }
      if (url.endsWith('/User')) {
        return Promise.resolve({ data: [{ employeeId: 1, employeeName: 'Alice' }] });
      }
      if (url.endsWith('/Branch')) {
        return Promise.resolve({ data: [{ branchID: 1, branchName: 'Head Office' }] });
      }
      if (url.includes('/Item/itemIngredient/item/')) {
        return Promise.resolve({ data: [{ itemID: 201, itemName: 'Metal Plate', quantity: 2 }] });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    mockApi.put.mockResolvedValue({});

    render(<CraftingItems />);

    const card = await waitFor(() => screen.getByText(/Circuit Board A1/i).closest('.job-card') as HTMLElement);
    expect(card).toBeInTheDocument();
    expect(card.style.transform).toBe('');

    card.getBoundingClientRect = jest.fn(() => ({
      width: 100,
      height: 100,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as any));

    fireEvent.mouseMove(card, { clientX: 60, clientY: 60 });
    expect(card.style.transform).not.toBe('');

    fireEvent.mouseLeave(card);
    expect(card.style.transform).toBe('');
  });
});
