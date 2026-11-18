import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, LockKeyhole } from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore, type AuthUser, type UserRole } from "@/stores/auth-store";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import "./AuthPages.css";

interface AccountRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}

function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <SiteHeader />
      <main className="auth-page">
        <div className="auth-page__image" aria-hidden="true" />
        <div className="auth-page__content">
          <div className="auth-card">
            <span className="maison-eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p className="auth-card__description">{description}</p>
            {children}
            <div className="auth-card__footer">{footer}</div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function getRoleDestination(role: UserRole) {
  if (role === "receptionist") return "/reception";
  if (role === "admin") return "/admin";
  return "/my-bookings";
}

export function LoginPage() {
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await api.get<AccountRecord[]>("/users", {
        params: { email: normalizedEmail },
      });

      const account = response.data.find(
        (item) =>
          item.email.toLowerCase() === normalizedEmail &&
          item.password === password,
      );

      if (!account) {
        setError("The email or password you entered is incorrect.");
        return;
      }

      const user: AuthUser = {
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role,
      };

      login(user);

      const previousPath = (
        location.state as { from?: { pathname?: string } } | null
      )?.from?.pathname;

      navigate(
        previousPath && previousPath !== "/login"
          ? previousPath
          : getRoleDestination(account.role),
        { replace: true },
      );
    } catch {
      setError("Unable to connect to Maison. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Your stay awaits."
      description="Sign in to access your reservations and continue your Maison experience."
      footer={
        <p>
          New to Maison? <Link to="/signup">Create an account</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && <p className="auth-form__error" role="alert">{error}</p>}

        <button className="auth-form__submit" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
          {!loading && <ArrowRight size={17} />}
        </button>
      </form>

      <div className="auth-demo">
        <div className="auth-demo__heading">
          <LockKeyhole size={15} />
          <span>Demo access</span>
        </div>
        <div className="auth-demo__account">
          <span>Guest</span>
          <code>guest@hotel.com</code>
          <button
            type="button"
            onClick={() => {
              setEmail("guest@hotel.com");
              setPassword("Guest123!");
              setError("");
            }}
          >
            Use account
          </button>
        </div>
        <div className="auth-demo__account">
          <span>Reception</span>
          <code>reception@hotel.com</code>
          <button
            type="button"
            onClick={() => {
              setEmail("reception@hotel.com");
              setPassword("Reception123!");
              setError("");
            }}
          >
            Use account
          </button>
        </div>
        <div className="auth-demo__account">
          <span>Admin</span>
          <code>admin@hotel.com</code>
          <button
            type="button"
            onClick={() => {
              setEmail("admin@hotel.com");
              setPassword("Admin123!");
              setError("");
            }}
          >
            Use account
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}

export function SignupPage() {
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    setLoading(true);
    let createdUserId: string | null = null;

    try {
      const existingUsers = await api.get<AccountRecord[]>("/users", {
        params: { email: normalizedEmail },
      });

      if (
        existingUsers.data.some(
          (user) => user.email.toLowerCase() === normalizedEmail,
        )
      ) {
        setError("An account with this email already exists.");
        return;
      }

      const userId = `user-${Date.now()}`;
      const guestId = `guest-${Date.now()}`;
      const cleanName = name.trim();

      await api.post("/users", {
        id: userId,
        name: cleanName,
        email: normalizedEmail,
        password,
        role: "guest",
      });

      createdUserId = userId;

      await api.post("/guests", {
        id: guestId,
        name: cleanName,
        email: normalizedEmail,
        phone: phone.trim(),
      });

      const user: AuthUser = {
        id: userId,
        name: cleanName,
        email: normalizedEmail,
        role: "guest",
      };

      login(user);
      navigate("/my-bookings", { replace: true });
    } catch {
      if (createdUserId) {
        try {
          await api.delete(`/users/${createdUserId}`);
        } catch {
          setError(
            "Your guest profile could not be completed. Please contact support.",
          );
          return;
        }
      }

      setError("Unable to create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Join Maison"
      title="Begin your journey."
      description="Create your guest account and discover a more thoughtful way to travel."
      footer={
        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="signup-name">Full name</label>
        <input
          id="signup-name"
          type="text"
          autoComplete="name"
          placeholder="Your full name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

        <label htmlFor="signup-email">Email address</label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="signup-phone">Phone number</label>
        <input
          id="signup-phone"
          type="tel"
          autoComplete="tel"
          placeholder="+1 202 555 0100"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />

        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />

        <label htmlFor="signup-confirm-password">Confirm password</label>
        <input
          id="signup-confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="Enter your password again"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={8}
          required
        />

        {error && <p className="auth-form__error" role="alert">{error}</p>}

        <button className="auth-form__submit" type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
          {!loading && <ArrowUpRight size={17} />}
        </button>
      </form>
    </AuthLayout>
  );
}
