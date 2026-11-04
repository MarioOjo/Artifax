import { render, screen } from '@testing-library/react';
import App from './App';
import { getCurrentUserFromSession } from './services/authApi';

jest.mock('./services/authApi', () => ({
  ...jest.requireActual('./services/authApi'),
  getCurrentUserFromSession: jest.fn(),
}));

test('sends visitors without a session to the login page', async () => {
  getCurrentUserFromSession.mockResolvedValue(null);

  render(<App />);

  expect(await screen.findByRole('heading', { name: /Login/i })).toBeInTheDocument();
});
