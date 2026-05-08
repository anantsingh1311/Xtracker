import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getStoredUser, hasCompletedFitnessProfile, isAdmin, isAuthenticated } from "../utils/auth";

export default function ProtectedRoute({ children, requireAdmin = false, requireProfile = true }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login-user" replace state={{ from: location.pathname }} />;
  }

  const user = getStoredUser();
  if (requireAdmin && !isAdmin(user)) {
    return <Navigate to="/create" replace />;
  }

  if (requireProfile && !hasCompletedFitnessProfile(user)) {
    return <Navigate to="/profile" replace state={{ from: location.pathname }} />;
  }

  return children;
}
