import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const HomePage = lazy(() =>
  import("@/pages/HomePage").then((module) => ({
    default: module.HomePage,
  })),
);

const RoomsPage = lazy(() =>
  import("@/pages/RoomsPage").then((module) => ({
    default: module.RoomsPage,
  })),
);

const RoomDetailsPage = lazy(() =>
  import("@/pages/RoomDetailsPage").then((module) => ({
    default: module.RoomDetailsPage,
  })),
);

const BookingPage = lazy(() =>
  import("@/pages/BookingPage").then((module) => ({
    default: module.BookingPage,
  })),
);

const CheckoutPage = lazy(() =>
  import("@/pages/CheckoutPage").then((module) => ({
    default: module.CheckoutPage,
  })),
);

const MyBookingsPage = lazy(() =>
  import("@/pages/MyBookingsPage").then((module) => ({
    default: module.MyBookingsPage,
  })),
);

const ReceptionPage = lazy(() =>
  import("@/pages/ReceptionPage").then((module) => ({
    default: module.ReceptionPage,
  })),
);

const AdminDashboardPage = lazy(() =>
  import("@/pages/AdminDashboardPage").then((module) => ({
    default: module.AdminDashboardPage,
  })),
);

const LoginPage = lazy(() =>
  import("@/pages/LoginPage").then((module) => ({
    default: module.LoginPage,
  })),
);

const SignupPage = lazy(() =>
  import("@/pages/SignupPage").then((module) => ({
    default: module.SignupPage,
  })),
);

function renderPage(element: React.ReactNode) {
  return <Suspense fallback={null}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: renderPage(<HomePage />),
  },
  {
    path: "/rooms",
    element: renderPage(<RoomsPage />),
  },
  {
    path: "/rooms/:roomId",
    element: renderPage(<RoomDetailsPage />),
  },
  {
    path: "/login",
    element: renderPage(<LoginPage />),
  },
  {
    path: "/signup",
    element: renderPage(<SignupPage />),
  },
  {
    element: <ProtectedRoute roles={["guest"]} />,
    children: [
      {
        path: "/booking",
        element: renderPage(<BookingPage />),
      },
      {
        path: "/checkout",
        element: renderPage(<CheckoutPage />),
      },
      {
        path: "/my-bookings",
        element: renderPage(<MyBookingsPage />),
      },
    ],
  },
  {
    element: <ProtectedRoute roles={["receptionist"]} />,
    children: [
      {
        path: "/reception",
        element: renderPage(<ReceptionPage />),
      },
    ],
  },
  {
    element: <ProtectedRoute roles={["admin"]} />,
    children: [
      {
        path: "/admin",
        element: renderPage(<AdminDashboardPage />),
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, "") });