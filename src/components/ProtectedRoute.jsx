import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAuthToken } from '../utils/session';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  if (!getAuthToken()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
