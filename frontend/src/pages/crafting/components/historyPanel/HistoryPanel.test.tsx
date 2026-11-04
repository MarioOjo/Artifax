import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import HistoryPanel from './historyPanel';
import { useApi } from '../../../../hooks';

jest.mock('../../../../hooks', () => ({
  useApi: jest.fn(),
  useThemeAwareIcon: (icon: string) => icon,
}));

const mockedUseApi = useApi as jest.MockedFunction<typeof useApi>;

const orders = [
  { orderID: 1, itemID: 10, itemName: 'Round Table', quantity: 2, status: 'Complete', employeeID: 1, createdDateTime: '2026-11-01T10:00:00Z', completedDateTime: '2026-11-01T11:00:00Z' },
  { orderID: 2, itemID: 11, itemName: 'Office Chair', quantity: 5, status: 'Cancelled', employeeID: 2, createdDateTime: '2026-11-02T10:00:00Z' },
  { orderID: 3, itemID: 12, itemName: 'Gear Assembly', quantity: 1, status: 'Active', employeeID: 1, createdDateTime: '2026-11-03T10:00:00Z' },
];

const users = [
  { employeeId: 1, employeeName: 'Alice' },
  { employeeId: 2, employeeName: 'Bob' },
];

describe('HistoryPanel', () => {
  beforeEach(() => {
    const get = jest.fn((url: string) => Promise.resolve({ data: url === '/User' ? users : orders }));
    mockedUseApi.mockReturnValue({ get } as any);
  });

  it('lists finished orders with employee names', async () => {
    render(<HistoryPanel />);

    expect(screen.getByText(/Crafting History/i)).toBeInTheDocument();
    expect(await screen.findByText('Round Table')).toBeInTheDocument();
    expect(screen.getByText('Office Chair')).toBeInTheDocument();
    expect(screen.getByText(/2 orders/i)).toBeInTheDocument();

    // Active orders are not history; employee names are resolved from /User
    expect(screen.queryByText('Gear Assembly')).not.toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('filters by search text, including employee name', async () => {
    render(<HistoryPanel />);
    await screen.findByText('Round Table');

    fireEvent.change(screen.getByLabelText(/Search:/i), { target: { value: 'bob' } });

    expect(screen.getByText('Office Chair')).toBeInTheDocument();
    expect(screen.queryByText('Round Table')).not.toBeInTheDocument();
  });

  it('filters by status tab', async () => {
    render(<HistoryPanel />);
    await screen.findByText('Round Table');

    const cancelledTab = screen.getByRole('button', { name: /Cancelled \(1\)/i });
    fireEvent.click(cancelledTab);

    expect(cancelledTab).toHaveClass('active');
    expect(screen.getByText('Office Chair')).toBeInTheDocument();
    expect(screen.queryByText('Round Table')).not.toBeInTheDocument();
  });
});
