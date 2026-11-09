import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Topbar from './Topbar';

jest.mock('../../utils/currentUser', () => ({
  useCurrentUser: () => ({ name: 'Test User', branchId: 1, branchName: 'Head Office' }),
}));

jest.mock('../../services/authApi', () => ({
  getBranchById: jest.fn(),
}));

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><Topbar /></MemoryRouter>);

describe('Topbar', () => {
  it('links the home breadcrumb back to the dashboard', () => {
    renderAt('/inventory');

    expect(screen.getByRole('link', { name: /Artifax/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByText('Inventory').closest('[aria-current="page"]')).not.toBeNull();
  });

  it('labels the theme toggle and shows the branch as plain text', () => {
    renderAt('/dashboard');

    expect(screen.getByRole('checkbox', { name: /Switch to (light|dark) theme/i })).toBeInTheDocument();
    expect(screen.getByText('Head Office')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Head Office' })).not.toBeInTheDocument();
  });
});
