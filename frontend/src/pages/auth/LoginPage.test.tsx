import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage, { SLOW_SIGN_IN_MS } from './LoginPage';
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

  it('explains a slow sign-in while the server wakes up', async () => {
    jest.useFakeTimers();
    try {
      (loginEmployee as jest.Mock).mockReturnValue(new Promise(() => {})); // never answers
      const { container } = renderPage();

      fireEvent.change(container.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: 'user@artifax.local' } });
      fireEvent.change(container.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: 'secret' } });
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));

      expect(screen.queryByText(/Waking up the server/i)).not.toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(SLOW_SIGN_IN_MS);
      });

      expect(screen.getByText(/Waking up the server/i)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
