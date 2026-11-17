import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import type { UserRole } from "@/types";
import { HomePage } from "@/pages/HomePage";
import { RoomDetailsPage } from "@/pages/RoomDetailsPage";
import { BookingPage } from "@/pages/BookingPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { MyBookingsPage } from "@/pages/MyBookingsPage";
import { ReceptionPage } from "@/pages/ReceptionPage";
import { AdminDashboardPage } from "@/pages/AdminDashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";

function ProtectedRoute({ roles }: { roles: UserRole[] }) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!roles.includes(user.role)) {
    if (user.role === "guest") return <Navigate to="/my-bookings" replace />;
    if (user.role === "receptionist") return <Navigate to="/reception" replace />;
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/rooms/:roomId", element: <RoomDetailsPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },

  {
    element: <ProtectedRoute roles={["guest"]} />,
    children: [
      { path: "/booking", element: <BookingPage /> },
      { path: "/checkout", element: <CheckoutPage /> },
      { path: "/my-bookings", element: <MyBookingsPage /> },
    ],
  },

  {
    element: <ProtectedRoute roles={["receptionist"]} />,
    children: [
      { path: "/reception", element: <ReceptionPage /> },
    ],
  },

  {
    element: <ProtectedRoute roles={["admin"]} />,
    children: [
      { path: "/admin", element: <AdminDashboardPage /> },
    ],
  },

  { path: "*", element: <Navigate to="/" replace /> },
]);
