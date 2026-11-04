import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OtpVerifyPage from './OtpVerifyPage';
import { GetOtpQrCode } from '../../services/authApi';

jest.mock('../../services/authApi', () => ({
  GetOtpQrCode: jest.fn(),
  VerifyOtpCode: jest.fn(),
  getCurrentUserFromSession: jest.fn(),
  getEmployeeByEmail: jest.fn(),
  getBranches: jest.fn(),
}));

const renderPage = () => render(<MemoryRouter><OtpVerifyPage /></MemoryRouter>);

describe('OtpVerifyPage', () => {
  it('shows the setup QR code while two-factor authentication is not yet set up', async () => {
    (GetOtpQrCode as jest.Mock).mockResolvedValue({ qrCodeUri: 'otpauth://totp/ArtifaxApp:a?secret=ABC' });
    renderPage();

    fireEvent.click(screen.getByText(/First time\?/i));

    expect(await screen.findByText(/Scan this code/i)).toBeInTheDocument();
  });

  it('explains when the account already has two-factor authentication set up', async () => {
    (GetOtpQrCode as jest.Mock).mockRejectedValue(Object.assign(new Error('Two-factor authentication is already set up'), { status: 403 }));
    renderPage();

    fireEvent.click(screen.getByText(/First time\?/i));

    expect(await screen.findByText(/already set up for this account/i)).toBeInTheDocument();
    expect(screen.queryByText(/Scan this code/i)).not.toBeInTheDocument();
  });
});
