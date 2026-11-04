import React from 'react';
import { render, screen } from '@testing-library/react';
import GraphCard from './graph';
import { useApi } from '../../../../hooks';

jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="chart-line" />,
}));

jest.mock('../../../../hooks', () => ({
  useApi: jest.fn(),
  useThemeAwareIcon: (icon: string) => icon,
}));

const mockedUseApi = useApi as jest.MockedFunction<typeof useApi>;

describe('GraphCard', () => {
  beforeEach(() => {
    const get = jest.fn((url: string) =>
      Promise.resolve({ data: url === '/Order' ? [] : [{ itemID: 1, itemName: 'Round Table', price: 100 }] }));
    mockedUseApi.mockReturnValue({ get } as any);
  });

  it('renders the analytics graph card for the first blueprint', async () => {
    render(<GraphCard />);

    expect(screen.getByText(/Completed craft analytics/i)).toBeInTheDocument();
    expect(await screen.findByTestId('chart-line')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Round Table')).toBeInTheDocument();
  });
});
