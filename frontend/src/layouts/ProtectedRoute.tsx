import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getCurrentUserFromSession } from '../services/authApi';

const ProtectedRoute: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const user = await getCurrentUserFromSession();
      
      if (user && (user.Username || user.username)) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    };

    checkSession();
  }, []);

  // Blocks layouts and Sidebars from rendering while verifying cookie state
  if (isAuthenticated === null) {
    return (
      <div className="session-loader" role="status" aria-label="Verifying session">
        <span className="session-loader-spinner" aria-hidden="true" />
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;