import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "../AuthPages";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth-store";

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

const accounts = {
  guest: {
    id: "user-guest",
    name: "Olivia Bennett",
    email: "guest@hotel.com",
    password: "Guest123!",
    role: "guest" as const,
  },
  receptionist: {
    id: "user-reception",
    name: "Reception Manager",
    email: "reception@hotel.com",
    password: "Reception123!",
    role: "receptionist" as const,
  },
  admin: {
    id: "user-admin",
    name: "Hotel Administrator",
    email: "admin@hotel.com",
    password: "Admin123!",
    role: "admin" as const,
  },
};

function renderLogin(initialEntry: string | {
  pathname: string;
  state?: unknown;
} = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/my-bookings" element={<h1>Guest dashboard</h1>} />
        <Route path="/reception" element={<h1>Reception dashboard</h1>} />
        <Route path="/admin" element={<h1>Admin dashboard</h1>} />
        <Route path="/checkout" element={<h1>Checkout page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitLogin(email: string, password: string) {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("Email address"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
    });
  });

  it("renders the login form and demo accounts", () => {
    renderLogin();

    expect(
      screen.getByRole("heading", { name: "Your stay awaits." }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();

    expect(
      screen.getAllByRole("button", { name: "Use account" }),
    ).toHaveLength(3);
  });

  it("fills the guest demo credentials", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(
      screen.getAllByRole("button", { name: "Use account" })[0],
    );

    expect(screen.getByLabelText("Email address")).toHaveValue(
      "guest@hotel.com",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("Guest123!");
  });

  it("fills the receptionist demo credentials", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(
      screen.getAllByRole("button", { name: "Use account" })[1],
    );

    expect(screen.getByLabelText("Email address")).toHaveValue(
      "reception@hotel.com",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("Reception123!");
  });

  it("fills the admin demo credentials", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(
      screen.getAllByRole("button", { name: "Use account" })[2],
    );

    expect(screen.getByLabelText("Email address")).toHaveValue(
      "admin@hotel.com",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("Admin123!");
  });

  it("displays an error when credentials are incorrect", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [accounts.guest],
    } as never);

    renderLogin();

    await submitLogin("guest@hotel.com", "WrongPassword!");

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "The email or password you entered is incorrect.",
    );
  });

  it("displays a connection error when the API request fails", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Network error"));

    renderLogin();

    await submitLogin("guest@hotel.com", "Guest123!");

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "Unable to connect to Maison. Please try again.",
    );
  });

  it("normalizes the email before authenticating", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [accounts.guest],
    } as never);

    renderLogin();

    await submitLogin("GUEST@HOTEL.COM", "Guest123!");

    expect(api.get).toHaveBeenCalledWith("/users", {
      params: { email: "guest@hotel.com" },
    });

    expect(
      await screen.findByRole("heading", { name: "Guest dashboard" }),
    ).toBeInTheDocument();
  });

  it("redirects each account to its role dashboard", async () => {
    const scenarios = [
      { account: accounts.guest, destination: "Guest dashboard" },
      {
        account: accounts.receptionist,
        destination: "Reception dashboard",
      },
      { account: accounts.admin, destination: "Admin dashboard" },
    ];

    for (const scenario of scenarios) {
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
      });

      vi.mocked(api.get).mockResolvedValueOnce({
        data: [scenario.account],
      } as never);

      const user = userEvent.setup();

      const view = renderLogin();

      await user.type(
        screen.getByLabelText("Email address"),
        scenario.account.email,
      );
      await user.type(
        screen.getByLabelText("Password"),
        scenario.account.password,
      );
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      expect(
        await screen.findByRole("heading", {
          name: scenario.destination,
        }),
      ).toBeInTheDocument();

      view.unmount();
    }
  });

  it("returns users to the page they originally requested", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [accounts.guest],
    } as never);

    renderLogin({
      pathname: "/login",
      state: { from: { pathname: "/checkout" } },
    });

    await submitLogin("guest@hotel.com", "Guest123!");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Checkout page" }),
      ).toBeInTheDocument();
    });
  });
});
