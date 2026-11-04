import React from 'react';
import { render, screen } from '@testing-library/react';
import AnalyticsPage from './analytics';
import { useApi } from '../../hooks';
import { getInventoryOverview } from '../../services/inventoryApi';

jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="chart-line" />,
}));

jest.mock('../../hooks', () => ({
  useApi: jest.fn(),
  useThemeAwareIcon: (icon: string) => icon,
}));

jest.mock('../../services/inventoryApi', () => ({
  getInventoryOverview: jest.fn(),
}));

const mockedUseApi = useApi as jest.MockedFunction<typeof useApi>;

describe('AnalyticsPage', () => {
  beforeEach(() => {
    mockedUseApi.mockReturnValue({ get: jest.fn().mockResolvedValue({ data: [] }) } as any);
    (getInventoryOverview as jest.Mock).mockResolvedValue({ alerts: ['Workbench (3 remaining)'] });
  });

  it('renders the header, low-stock alerts, graph and most crafted section', async () => {
    render(<AnalyticsPage />);

    expect(screen.getByRole('heading', { level: 1, name: /Analytics/i })).toBeInTheDocument();
    expect(await screen.findByTestId('chart-line')).toBeInTheDocument();
    expect(screen.getByText(/Most Crafted Blueprints/i)).toBeInTheDocument();
    expect(await screen.findByText(/Low Stock: 1/i)).toBeInTheDocument();
  });
});
