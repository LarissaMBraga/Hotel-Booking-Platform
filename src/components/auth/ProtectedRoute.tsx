import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import type { UserRole } from "@/types";

type ProtectedRouteProps = {
  roles: UserRole[];
};

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!roles.includes(user.role)) {
    if (user.role === "guest") {
      return <Navigate to="/my-bookings" replace />;
    }

    if (user.role === "receptionist") {
      return <Navigate to="/reception" replace />;
    }

    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}