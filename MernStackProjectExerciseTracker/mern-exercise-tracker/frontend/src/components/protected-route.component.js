import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAuthChangeEventName, getStoredUser, hasCompletedFitnessProfile, isAdmin } from "../utils/auth";

export default function ProtectedRoute({ children, requireAdmin = false, requireProfile = true }) {
  const location = useLocation();
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser());

    window.addEventListener("storage", syncUser);
    window.addEventListener(getAuthChangeEventName(), syncUser);

    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener(getAuthChangeEventName(), syncUser);
    };
  }, []);

  if (!user) {
    return <Navigate to="/login-user" replace state={{ from: location.pathname }} />;
  }

  if (requireAdmin && !isAdmin(user)) {
    return <Navigate to="/create" replace />;
  }

  if (requireProfile && !hasCompletedFitnessProfile(user)) {
    return <Navigate to="/profile" replace state={{ from: location.pathname }} />;
  }

  return children;
}
