import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useApi } from '../../hooks';
import Users from './users';

jest.mock('../../hooks');

const mockedUseApi = useApi as jest.MockedFunction<typeof useApi>;

describe('Users page', () => {
  const adminUser = {
    employeeId: 1,
    employeeName: 'Admin One',
    employeeEmail: 'admin.one@example.com',
    branchId: 10,
  };

  const employeeUser = {
    employeeId: 2,
    employeeName: 'Employee Two',
    employeeEmail: 'employee.two@example.com',
    branchId: 20,
  };

  const branchList = [
    { branchID: 10, branchName: 'Head Office' },
    { branchID: 20, branchName: 'Field Branch' },
  ];

  let api: any;
  let created = false;

  beforeEach(() => {
    jest.clearAllMocks();
    created = false;
    api = {
      get: jest.fn((url: string) => {
        if (url === '/User/admins') {
          return Promise.resolve({ data: [adminUser] });
        }
        if (url === '/User/employees') {
          return Promise.resolve({ data: [employeeUser, created ? {
            employeeId: 4,
            employeeName: 'New User',
            employeeEmail: 'new.user@example.com',
            branchId: 10,
          } : null].filter(Boolean) });
        }
        if (url === '/Branch') {
          return Promise.resolve({ data: branchList });
        }
        if (url === '/User/me') {
          return Promise.resolve({ data: { employeeEmail: 'admin.one@example.com' } });
        }
        return Promise.reject(new Error(`Unexpected GET ${url}`));
      }),
      post: jest.fn(() => {
        created = true;
        return Promise.resolve({ data: { employeeId: 4 } });
      }),
      patch: jest.fn(),
      delete: jest.fn(() => Promise.resolve({})),
    };

    mockedUseApi.mockReturnValue(api as any);
    window.localStorage.clear();
  });

  it('loads users and renders the user list', async () => {
    render(<Users />);

    expect(screen.getByText(/Loading users\.\.\./i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Admin One/i)).toBeInTheDocument();
      expect(screen.getByText(/Employee Two/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Head Office/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Field Branch/i).length).toBeGreaterThan(0);
  });

  it('selects a user and toggles to the edit state', async () => {
    render(<Users />);

    await waitFor(() => screen.getByText(/Admin One/i));
    fireEvent.click(screen.getByText(/Admin One/i));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete User/i })).toBeInTheDocument();
    });
  });

  it('creates a new user and refreshes the list after save', async () => {
    render(<Users />);

    await waitFor(() => screen.getByText(/Employee Two/i));

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'New User' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'new.user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter password/i), { target: { value: 'password1' } });

    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/User/employee', {
        BranchID: 10,
        EmployeeEmail: 'new.user@example.com',
        EmployeeName: 'New User',
        EmployeePassword: 'password1',
        EmployeeLevel: 'Admin',
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();
    });
  });

  it('asks for confirmation before removing a user, and does nothing when cancelled', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Users />);

    await waitFor(() => screen.getByText(/Employee Two/i));
    fireEvent.click(screen.getByText(/Employee Two/i));
    fireEvent.click(await screen.findByRole('button', { name: /Delete User/i }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/history are kept/i));
    expect(api.delete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('removes the user once confirmed', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Users />);

    await waitFor(() => screen.getByText(/Employee Two/i));
    fireEvent.click(screen.getByText(/Employee Two/i));
    fireEvent.click(await screen.findByRole('button', { name: /Delete User/i }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/User/employee?id=2'));
    confirmSpy.mockRestore();
  });
});
