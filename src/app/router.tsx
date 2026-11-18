import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { HomePage } from "@/pages/HomePage";
import { RoomsPage } from "@/pages/RoomsPage";
import { RoomDetailsPage } from "@/pages/RoomDetailsPage";
import { BookingPage } from "@/pages/BookingPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { MyBookingsPage } from "@/pages/MyBookingsPage";
import { ReceptionPage } from "@/pages/ReceptionPage";
import { AdminDashboardPage } from "@/pages/AdminDashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/rooms", element: <RoomsPage /> },
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