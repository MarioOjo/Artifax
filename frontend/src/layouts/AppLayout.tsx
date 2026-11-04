import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import { useCurrentUser } from '../utils/currentUser';

function AppLayout() {
  const isDemo = useCurrentUser()?.role?.toLowerCase() === 'demo';

  return (
    <div className="min-h-screen bg-app text-text flex">
      <Sidebar />
      <div className="min-h-screen min-w-0 flex-1">
        <Topbar />
        {isDemo && (
          <p role="status" className="mx-4 mt-4 rounded-lg border border-border bg-surface px-4 py-2 text-sm text-muted sm:mx-6 lg:mx-8">
            You are using the read-only demo account. You can explore everything, but changes are disabled.
          </p>
        )}
        <main className="px-4 pb-8 pt-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
