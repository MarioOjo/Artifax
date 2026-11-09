import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import UserList from './UserList';

type User = {
  id: number;
  name: string;
  email: string;
  branch: string;
  role: string;
  status: string;
};

describe('UserList', () => {
  const users: User[] = [
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', branch: '1', role: 'Admin', status: 'Active' },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com', branch: '2', role: 'Employee', status: 'Active' },
  ];

  const branchMap = { 1: 'Head Office', 2: 'Warehouse B' };
  const onSelectUser = jest.fn();
  const onCreateNewUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders users and branch names with loading state', () => {
    render(
      <UserList
        users={users}
        selectedUserId={null}
        loading={true}
        onSelectUser={onSelectUser}
        onCreateNewUser={onCreateNewUser}
        branchMap={branchMap}
      />
    );

    expect(screen.getByText(/Alice Johnson/i)).toBeInTheDocument();
    expect(screen.getByText(/alice@example.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Head Office/i)).toBeInTheDocument();
    expect(screen.getByText(/Admin/i)).toBeInTheDocument();
    expect(screen.getByText(/Warehouse B/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create new user/i })).toBeInTheDocument();
    expect(screen.getByText(/Loading users\.\.\./i)).toBeInTheDocument();
  });

  it('filters users by search query and triggers selection', () => {
    render(
      <UserList
        users={users}
        selectedUserId={2}
        loading={false}
        onSelectUser={onSelectUser}
        onCreateNewUser={onCreateNewUser}
        branchMap={branchMap}
      />
    );

    const searchInput = screen.getByRole('searchbox', { name: /Search users/i });
    fireEvent.change(searchInput, { target: { value: 'alice' } });

    expect(screen.getByText(/Alice Johnson/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bob Smith/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Alice Johnson/i));
    expect(onSelectUser).toHaveBeenCalledWith(1);
  });

  it('shows an empty state when no users match the search', () => {
    render(
      <UserList
        users={users}
        selectedUserId={null}
        loading={false}
        onSelectUser={onSelectUser}
        onCreateNewUser={onCreateNewUser}
        branchMap={branchMap}
      />
    );

    fireEvent.change(screen.getByRole('searchbox', { name: /Search users/i }), {
      target: { value: 'zzzzz' },
    });

    expect(screen.getByText(/No users match your search\./i)).toBeInTheDocument();
  });

  it('shows a load error with Retry instead of an empty list when loading fails', () => {
    const onRetry = jest.fn();
    render(
      <UserList
        users={[]}
        selectedUserId={null}
        loading={false}
        loadError
        onRetry={onRetry}
        onSelectUser={onSelectUser}
        onCreateNewUser={onCreateNewUser}
        branchMap={branchMap}
      />
    );

    expect(screen.getByText(/Couldn't load users/i)).toBeInTheDocument();
    expect(screen.queryByText(/pull from API/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
