import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewBlueprint from './newBlueprint';
import { useApi } from '../../../../hooks';
import { showSuccess, showError } from '../../../../utils/toast';

jest.mock('../../../../hooks', () => ({
  useApi: jest.fn(),
  useThemeAwareIcon: (icon: string) => icon,
}));
jest.mock('../../../../utils/toast', () => ({
  showSuccess: jest.fn(),
  showError: jest.fn(),
}));

describe('NewBlueprint', () => {
  const mockedUseApi = useApi as jest.MockedFunction<typeof useApi>;
  const mockedShowSuccess = showSuccess as jest.MockedFunction<typeof showSuccess>;
  const mockedShowError = showError as jest.MockedFunction<typeof showError>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseApi.mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: [] }),
      post: jest.fn(),
      put: jest.fn(),
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('disables the submit button until a name is provided and allows adding/removing materials', async () => {
    const onCancel = jest.fn();
    render(<NewBlueprint onCancel={onCancel} />);

    await waitFor(() => {
      expect(mockedUseApi).toHaveBeenCalled();
    });

    const submitButton = screen.getByRole('button', { name: /Add Blueprint/i });
    expect(submitButton).toBeDisabled();

    const blueprintNameInput = screen.getByLabelText(/Blueprint Name/i);
    fireEvent.change(blueprintNameInput, { target: { value: 'Test Blueprint' } });
    expect(submitButton).not.toBeDisabled();

    const addMaterialButton = screen.getByText(/\+ Add material to blueprint/i);
    fireEvent.click(addMaterialButton);
    expect(screen.getAllByLabelText(/Select material/i)).toHaveLength(4);

    const removeButtons = screen.getAllByLabelText(/Remove material/i);
    fireEvent.click(removeButtons[0]);
    expect(screen.getAllByLabelText(/Select material/i)).toHaveLength(3);
  });

  it('submits the form and calls cancel after successful blueprint creation', async () => {
    const apiMock = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
    } as any;

    mockedUseApi.mockReturnValue(apiMock);
    apiMock.get
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ branchID: 1 }] });
    apiMock.post
      .mockResolvedValueOnce({ data: { itemID: 999 } })
      .mockResolvedValueOnce({ data: { itemID: 202 } })
      .mockResolvedValueOnce({});
    apiMock.put.mockResolvedValueOnce({});

    const onCancel = jest.fn();
    const { container } = render(<NewBlueprint onCancel={onCancel} />);

    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(/Craft Time \(min\)/i), { target: { value: '3' } });

    const materialIncrementButtons = screen.getAllByRole('button', { name: '+' });
    fireEvent.click(materialIncrementButtons[0]);
    expect(container.querySelector('.amount-value')?.textContent).toBe('2');

    const materialDecrementButtons = screen.getAllByRole('button', { name: '-' });
    fireEvent.click(materialDecrementButtons[0]);
    expect(container.querySelector('.amount-value')?.textContent).toBe('1');

    fireEvent.change(screen.getByLabelText(/Blueprint Name/i), { target: { value: 'Test Blueprint' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Blueprint/i }));

    await waitFor(() => {
      expect(mockedShowSuccess).toHaveBeenCalledWith(
        'Blueprint created successfully. Returning to crafting page.'
      );
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  it('shows an error alert if the blueprint creation request fails', async () => {
    const apiMock = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
    } as any;

    mockedUseApi.mockReturnValue(apiMock);
    apiMock.get
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });
    apiMock.post
      .mockResolvedValueOnce({ data: { itemID: 999 } })
      .mockResolvedValueOnce({ data: { itemID: 202 } });
    apiMock.put.mockRejectedValueOnce(new Error('Unable to save blueprint'));

    const onCancel = jest.fn();
    render(<NewBlueprint onCancel={onCancel} />);

    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(/Blueprint Name/i), { target: { value: 'Test Blueprint' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Blueprint/i }));

    await waitFor(() => {
      expect(mockedShowError).toHaveBeenCalledWith(
        'Unable to save blueprint. Please fix the issue and try again.'
      );
      expect(onCancel).not.toHaveBeenCalled();
    });
  });
});
