import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { loginEmployee } from '../../services/authApi';

jest.mock('../../services/authApi', () => ({
  loginEmployee: jest.fn(),
}));

const renderPage = () => render(<MemoryRouter><LoginPage /></MemoryRouter>);

describe('LoginPage', () => {
  it('shows no alert before the user has tried to sign in', () => {
    renderPage();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/Input required/i)).not.toBeInTheDocument();
  });

  it('shows a login error after a failed sign-in', async () => {
    (loginEmployee as jest.Mock).mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    const { container } = renderPage();

    fireEvent.change(container.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: 'user@artifax.local' } });
    fireEvent.change(container.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  });
});
