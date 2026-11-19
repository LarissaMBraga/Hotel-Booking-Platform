import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../ProtectedRoute";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";

const users: Record<string, AuthUser> = {
  guest: {
    id: "guest-1",
    name: "Olivia Bennett",
    email: "guest@hotel.com",
    role: "guest",
  },
  receptionist: {
    id: "reception-1",
    name: "Reception User",
    email: "reception@hotel.com",
    role: "receptionist",
  },
  admin: {
    id: "admin-1",
    name: "Admin User",
    email: "admin@hotel.com",
    role: "admin",
  },
};

function renderProtectedRoute(
  path: string,
  allowedRoles: AuthUser["role"][],
  user: AuthUser | null,
) {
  useAuthStore.setState({
    user,
    isAuthenticated: Boolean(user),
  });

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<h1>Login page</h1>} />
        <Route path="/my-bookings" element={<h1>Guest dashboard</h1>} />
        <Route path="/reception" element={<h1>Reception dashboard</h1>} />
        <Route path="/admin" element={<h1>Admin dashboard</h1>} />

        <Route element={<ProtectedRoute roles={allowedRoles} />}>
          <Route path="/protected" element={<h1>Protected content</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
    });
  });

  it("redirects unauthenticated users to login", () => {
    renderProtectedRoute("/protected", ["guest"], null);

    expect(
      screen.getByRole("heading", { name: "Login page" }),
    ).toBeInTheDocument();
  });

  it("allows a guest to access a guest route", () => {
    renderProtectedRoute("/protected", ["guest"], users.guest);

    expect(
      screen.getByRole("heading", { name: "Protected content" }),
    ).toBeInTheDocument();
  });

  it("redirects a guest away from a receptionist route", () => {
    renderProtectedRoute("/protected", ["receptionist"], users.guest);

    expect(
      screen.getByRole("heading", { name: "Guest dashboard" }),
    ).toBeInTheDocument();
  });

  it("redirects a guest away from an admin route", () => {
    renderProtectedRoute("/protected", ["admin"], users.guest);

    expect(
      screen.getByRole("heading", { name: "Guest dashboard" }),
    ).toBeInTheDocument();
  });

  it("allows a receptionist to access a receptionist route", () => {
    renderProtectedRoute(
      "/protected",
      ["receptionist"],
      users.receptionist,
    );

    expect(
      screen.getByRole("heading", { name: "Protected content" }),
    ).toBeInTheDocument();
  });

  it("redirects a receptionist away from an admin route", () => {
    renderProtectedRoute("/protected", ["admin"], users.receptionist);

    expect(
      screen.getByRole("heading", { name: "Reception dashboard" }),
    ).toBeInTheDocument();
  });

  it("allows an admin to access an admin route", () => {
    renderProtectedRoute("/protected", ["admin"], users.admin);

    expect(
      screen.getByRole("heading", { name: "Protected content" }),
    ).toBeInTheDocument();
  });

  it("redirects an admin away from a receptionist route", () => {
    renderProtectedRoute("/protected", ["receptionist"], users.admin);

    expect(
      screen.getByRole("heading", { name: "Admin dashboard" }),
    ).toBeInTheDocument();
  });
});
