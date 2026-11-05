import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import CraeteUsersPage from './componets/craeteUser/craeteusers';
import UserList from './componets/userList/UserList';
import { getCurrentDateSAST } from '../../Date/dateUtils';
import { useApi } from '../../hooks';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { getCurrentUser, setCurrentUser } from '../../utils/currentUser';
import { showError, showSuccess } from '../../utils/toast';


type User = {
  id: number;
  name: string;
  email: string;
  branch: string;
  role: string;
  status: string;
};

const Users: React.FC = () => {
  const currentDate = getCurrentDateSAST();
  const api = useApi();
  const [confirm, confirmDialog] = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [branchMap, setBranchMap] = useState<Record<number, string>>({});
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // ensure we only try fetching users once per page load
  const usersFetchedRef = useRef(false);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? undefined,
    [users, selectedUserId]
  );

  const handleSelectUser = (id: number) => {
    setSelectedUserId(id);
  };

  const handleCreateNewUser = () => {
    setSelectedUserId(null);
  };

  const fetchUsers = useCallback(async (): Promise<User[]> => {
    setLoading(true);
    try {
      const [adminsResp, employeesResp, branchesResp] = await Promise.all([
        api.get('/User/admins'),
        api.get('/User/employees'),
        api.get('/Branch'),
      ]);

      const branches = branchesResp.data ?? [];
      const map: Record<number, string> = {};
      branches.forEach((b: any) => {
        const id = b.branchID ?? b.BranchID ?? b.branchId ?? b.BranchId ?? 0;
        const name = b.branchName ?? b.BranchName ?? b.name ?? '';
        if (id) map[id] = name;
      });
      setBranchMap(map);

      const makeUser = (e: any, role: 'Admin' | 'Employee') => {
        const id = e.employeeId ?? e.EmployeeId ?? e.EmployeeID ?? 0;
        const name = e.employeeName ?? e.EmployeeName ?? e.employeeName ?? '';
        const email = e.employeeEmail ?? e.EmployeeEmail ?? '';
        const branchId = e.branchId ?? e.BranchId ?? e.BranchID ?? 0;
        return {
          id,
          name,
          email,
          branch: String(branchId),
          role,
          status: 'Active',
        } as User;
      };

      const adminUsers = (adminsResp.data ?? []).map((e: any) => makeUser(e, 'Admin'));
      const employeeUsers = (employeesResp.data ?? []).map((e: any) => makeUser(e, 'Employee'));
      const combinedUsers = [...adminUsers, ...employeeUsers];

      setUsers(combinedUsers);
      return combinedUsers;
    } catch (err) {
      console.error('Fetch users failed', err);
      showError('Unable to load users. Please refresh the page.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [api]);

  const handleSaveUser = async (user: Omit<User, 'id'> & { id: number | null; password?: string }) => {
    try {
      if (user.id === null) {
        // Create new employee
        const payload = {
          BranchID: Number(user.branch),
          EmployeeEmail: user.email,
          EmployeeName: user.name,
          EmployeePassword: user.password ?? '',
          EmployeeLevel: user.role === 'Admin' ? 'Admin' : 'Employee',
        };
        // Verify current session is authorized (admin) before attempting create
        await api.get('/User/me');
        const resp = await api.post('/User/employee', payload);
        const created = resp.data;
        const createdId = created?.employeeId ?? created?.EmployeeId ?? created?.EmployeeID ?? null;
        const updatedUsers = await fetchUsers();
        if (createdId) {
          setSelectedUserId(createdId);
        } else {
          const matched = updatedUsers.find((u) => u.email.toLowerCase() === user.email.toLowerCase());
          if (matched) setSelectedUserId(matched.id);
        }
        showSuccess('User created successfully.');
        return;
      }

      // Update existing employee
      const existing = users.find((u) => u.id === user.id);
      const originalEmail = existing?.email ?? user.email;

      // If only branch changed, call branch-specific endpoint
      if (existing && existing.branch !== user.branch && existing.name === user.name && existing.email === user.email) {
        const branchUrl = `/User/employee/branch?EmployeeEmail=${encodeURIComponent(originalEmail)}&BranchId=${Number(
          user.branch
        )}`;
        await api.patch(branchUrl);
        await fetchUsers();
        setSelectedUserId(user.id);

        const currentUser = getCurrentUser();
        if (currentUser?.email?.toLowerCase() === originalEmail.toLowerCase()) {
          setCurrentUser({
            ...currentUser,
            branchId: Number(user.branch),
          });
        }

        showSuccess('User updated successfully.');
        return;
      }

      // General details update (name/email/password)
      const updatePayload: any = {
        BranchID: Number(user.branch),
        EmployeeEmail: user.email,
        EmployeeName: user.name,
        EmployeeLevel: user.role === 'Admin' ? 'Admin' : 'Employee',
      };

      if (typeof user.password === 'string' && user.password.length > 0) {
        updatePayload.EmployeePassword = user.password;
      }

      const updUrl = `/User/employee?EmployeeEmail=${encodeURIComponent(originalEmail)}`;
      await api.patch(updUrl, updatePayload);
      await fetchUsers();
      setSelectedUserId(user.id);

      const currentUser = getCurrentUser();
      if (currentUser?.email?.toLowerCase() === originalEmail.toLowerCase()) {
        setCurrentUser({
          ...currentUser,
          branchId: Number(user.branch),
          branchName: branchMap[Number(user.branch)] ?? currentUser.branchName,
          email: user.email,
          name: user.name,
          role: user.role,
        });
      }

      showSuccess('User updated successfully.');
    } catch (err) {
      console.error('Save user failed', err);
      showError('Unable to save user. Please try again.');
    }
  };

  const handleDeleteUser = async (id: number) => {
    // The API archives the user rather than deleting them, so their order history is kept
    const confirmed = await confirm({
      title: 'Remove user?',
      message: 'They will no longer be able to sign in. Their past orders and history are kept.',
      confirmLabel: 'Remove user',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/User/employee?id=${encodeURIComponent(String(id))}`);
      await fetchUsers();
      setSelectedUserId(null);
      showSuccess('User removed. Their order history is kept.');
      // do not clear or change current session when deleting a user
    } catch (err) {
      console.error('Delete user failed', err);
      showError('Unable to remove user. Please try again.');
    }
  };

  // For a user who lost their authenticator: their next sign-in shows a new setup QR code
  const handleResetTwoFactor = async (id: number) => {
    const confirmed = await confirm({
      title: 'Reset two-factor authentication?',
      message: 'Their next sign-in will show a new QR code to scan with their authenticator app.',
      confirmLabel: 'Reset 2FA',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    try {
      await api.patch(`/User/employee/reset-2fa?id=${encodeURIComponent(String(id))}`);
      showSuccess('Two-factor authentication reset. The user will set it up again at their next sign-in.');
    } catch (err) {
      console.error('Reset 2FA failed', err);
      showError('Unable to reset two-factor authentication. Please try again.');
    }
  };

  const handleRequestEdit = async (id: number) => {
    try {
      // Refresh users/branches from backend to ensure latest state before editing.
      await fetchUsers();
      return true;
    } catch (err) {
      console.error('Request edit failed', err);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    if (usersFetchedRef.current) return; // already attempted fetch
    usersFetchedRef.current = true;
    const timeoutId = setTimeout(() => {
      if (!mounted) return;
      console.error('Fetch users timed out');
      setLoading(false);
    }, 4000);

    (async () => {
      setLoading(true);
      try {
        await fetchUsers();
      } catch (err) {
        console.error('Fetch users failed', err);
      } finally {
        // noop
      }
    })();

    return () => { mounted = false; clearTimeout(timeoutId); };
  }, [fetchUsers]);

  return (
    <div className="page-content">
      <div className="space-y-4 sm:space-y-5">
        <PageHeader 
          title="User Management" 
          subtitle={`Manage users and add new accounts · ${currentDate}`} 
        />

        <div className="users-page grid gap-4 xl:grid-cols-[2fr,1fr]">
          <div className="users-panel">
            <CraeteUsersPage
              user={selectedUser}
              onSave={handleSaveUser}
              onDelete={handleDeleteUser}
              onRequestEdit={handleRequestEdit}
              onResetTwoFactor={handleResetTwoFactor}
            />
          </div>
          <div className="users-panel">
            <UserList
              users={users}
              selectedUserId={selectedUserId}
              loading={loading}
              onSelectUser={handleSelectUser}
              onCreateNewUser={handleCreateNewUser}
              branchMap={branchMap}
            />
          </div>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
};

export default Users;