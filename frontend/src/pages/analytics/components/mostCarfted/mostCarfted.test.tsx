import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MostCrafted from './mostCarfted';
import { useApi } from '../../../../hooks';

jest.mock('../../../../hooks', () => ({
  useApi: jest.fn(),
  useThemeAwareIcon: (icon: string) => icon,
}));

const mockedUseApi = useApi as jest.MockedFunction<typeof useApi>;

const orders = [
  { itemName: 'Round Table', quantity: 10, status: 'Complete' },
  { itemName: 'Hammer', quantity: 2, status: 'Complete' },
  { itemName: 'Round Table', quantity: 3, status: 'Complete' },
  { itemName: 'Office Chair', quantity: 50, status: 'Cancelled' },
  { itemName: 'Gear Assembly', quantity: 40, status: 'Active' },
];

describe('MostCrafted', () => {
  beforeEach(() => {
    mockedUseApi.mockReturnValue({ get: jest.fn().mockResolvedValue({ data: orders }) } as any);
  });

  it('totals completed quantities per item and sorts high to low, then low to high', async () => {
    render(<MostCrafted />);

    // Only completed orders count: Round Table 10 + 3, Hammer 2
    await screen.findByRole('heading', { level: 4, name: 'Round Table' });
    let headings = screen.getAllByRole('heading', { level: 4 });
    expect(headings.map((h) => h.textContent)).toEqual(['Round Table', 'Hammer']);

    fireEvent.click(screen.getByRole('button', { name: /Most crafted sort order/i }));
    fireEvent.click(screen.getByRole('option', { name: /Low to high/i }));

    headings = screen.getAllByRole('heading', { level: 4 });
    expect(headings.map((h) => h.textContent)).toEqual(['Hammer', 'Round Table']);
  });
});
