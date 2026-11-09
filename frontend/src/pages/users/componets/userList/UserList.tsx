import { useEffect, useMemo, useRef, useState } from 'react';
import userIcon from '../../../../assets/images/userIcon.png';
import './UserList.css';
import LoadError from '../../../../components/common/LoadError';

type User = {
  id: number;
  name: string;
  email: string;
  branch: string;
  role: string;
  status: string;
};

interface UserListProps {
  users: User[];
  selectedUserId: number | null;
  // `loading` is passed from the parent `Users` component. It reflects the GET /api/User request state.
  // We render a small footer status so the overall card height doesn't jump when loading starts/stops.
  loading: boolean;
  // True when the last users request failed; the list shows an error with Retry instead of "no users"
  loadError?: boolean;
  onRetry?: () => void;
  onSelectUser: (id: number) => void;
  onCreateNewUser: () => void;
  branchMap: Record<number, string>;
}

function UserList({ users, selectedUserId, loading, loadError = false, onRetry, onSelectUser, onCreateNewUser, branchMap }: UserListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const selectedRef = useRef<HTMLElement | null>(null);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase().trim();
    return users.filter((user) => user.name.toLowerCase().includes(query));
  }, [users, searchQuery]);
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedUserId, filteredUsers]);

  return (
    <section className="userlist-card">
      <header className="userlist-card-header">
        <div className="userlist-title-row">
          <div className="userlist-title-group">
            <div className="userlist-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M4.5 20c1.8-3.3 4.5-5 7.5-5s5.7 1.7 7.5 5" />
              </svg>
            </div>
          </div>
        </div>

        <div className="userlist-search-shell">
          <input
            className="userlist-search"
            type="search"
            placeholder="Search users..."
            aria-label="Search users"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="userlist-items">
        {loadError && users.length === 0 ? (
          <LoadError what="users" onRetry={onRetry} />
        ) : filteredUsers.length === 0 ? (
          <div className="userlist-empty">
            <p>{searchQuery.trim() ? 'No users match your search.' : loading ? '' : 'No users yet. Create one with the form.'}</p>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <article
              key={user.id}
              className={`userlist-item ${selectedUserId === user.id ? 'selected' : ''}`}
              ref={selectedUserId === user.id ? selectedRef : null}
              onClick={() => onSelectUser(user.id)}
              role="button"
              tabIndex={0}
            >
              <div className="userlist-avatar-shell">
                <img src={userIcon} alt="User icon" className="userlist-avatar" />
              </div>
              <div className="userlist-info">
                <div className="userlist-name-row">
                  <span className="userlist-name">{user.name}</span>
                </div>
                <p className="userlist-email">{user.email}</p>
              </div>
              <div className="userlist-card-meta">
                <span className={`userlist-role-tag ${user.role === 'Admin' ? 'role-admin' : 'role-employee'}`}>
                  {user.role}
                </span>
                <span className="userlist-branch-tag">
                  {branchMap[Number(user.branch)] ?? user.branch}
                </span>
              </div>
            </article>
          ))
        )}
      </div>

      <footer className="userlist-footer">
        <button type="button" className="userlist-button" onClick={onCreateNewUser}>
          Create new user
        </button>
        <div className="userlist-status" aria-live="polite">
          {loading ? 'Loading users...' : '\u00A0'}
        </div>
      </footer>
    </section>
  );
}

export default UserList;
