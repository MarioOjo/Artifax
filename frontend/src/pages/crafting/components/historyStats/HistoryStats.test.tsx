import React from 'react';
import { render, screen } from '@testing-library/react';
import HistoryStats from './historyStats';
import { useApi } from '../../../../hooks';

jest.mock('../../../../hooks', () => ({
  useApi: jest.fn(),
  useThemeAwareIcon: (icon: string) => icon,
}));

const mockedUseApi = useApi as jest.MockedFunction<typeof useApi>;

const orders = [
  { orderID: 1, quantity: 1, status: 'Queued' },
  { orderID: 2, quantity: 2, status: 'Cancelled' },
  { orderID: 3, quantity: 4, status: 'Cancelled' },
  { orderID: 4, quantity: 4, status: 'Complete', createdDateTime: '2026-11-01T10:00:00Z', completedDateTime: '2026-11-01T10:30:00Z' },
  { orderID: 5, quantity: 6, status: 'Complete', createdDateTime: '2026-11-01T10:00:00Z', completedDateTime: '2026-11-01T11:30:00Z' },
];

describe('HistoryStats', () => {
  beforeEach(() => {
    mockedUseApi.mockReturnValue({ get: jest.fn().mockResolvedValue({ data: orders }) } as any);
  });

  it('shows total orders, cancelled and completed quantities, and average duration', async () => {
    render(<HistoryStats />);

    expect(screen.getByText(/Total Jobs/i)).toBeInTheDocument();
    expect(screen.getByText(/Avg Duration/i)).toBeInTheDocument();

    // 5 orders in total; 2 + 4 cancelled; 4 + 6 completed; (30m + 90m) / 2 = 1h
    expect(await screen.findByText('5')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('1h')).toBeInTheDocument();
  });
});
