import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  LogOut,
  Menu,
  Moon,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useThemeStore } from "@/stores/theme-store";
import "./SiteLayout.css";

const navigation = [
  { label: "Home", href: "/" },
  { label: "Our rooms", href: "/#rooms" },
  { label: "Our story", href: "/#story" },
];

const dashboardByRole = {
  guest: { href: "/my-bookings", label: "My bookings" },
  receptionist: { href: "/reception", label: "Reception" },
  admin: { href: "/admin", label: "Dashboard" },
};

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);

  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const dashboard = user ? dashboardByRole[user.role] : null;

  const handleLogout = () => {
    logout();
    closeMenu();
    navigate("/");
  };

  const themeSwitch = (
    <>
      <span className="theme-toggle__icon theme-toggle__icon--sun">
        <Sun size={15} strokeWidth={1.8} />
      </span>
      <span className="theme-toggle__icon theme-toggle__icon--moon">
        <Moon size={15} strokeWidth={1.8} />
      </span>
      <span className="theme-toggle__thumb" />
    </>
  );

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link
          className="brand"
          to="/"
          aria-label="Maison Hotels home"
          onClick={closeMenu}
        >
          <span className="brand__name">MAISON</span>
          <span className="brand__caption">HOTELS & RESIDENCES</span>
        </Link>

        <nav className="site-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <a className="site-nav__link" href={item.href} key={item.label}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="site-header__actions">
          <button
            className={`theme-toggle ${theme === "dark" ? "is-dark" : ""}`}
            type="button"
            role="switch"
            aria-checked={theme === "dark"}
            aria-label="Toggle dark mode"
            title={theme === "light" ? "Dark mode" : "Light mode"}
            onClick={toggleTheme}
          >
            {themeSwitch}
          </button>

          {isAuthenticated && user && dashboard ? (
            <>
              <Link className="header-signin header-user" to={dashboard.href}>
                <UserRound size={16} strokeWidth={1.7} />
                <span>{user.name.split(" ")[0]}</span>
                <span className="header-user__dashboard">
                  {dashboard.label}
                </span>
              </Link>

              <button
                className="header-logout"
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={16} strokeWidth={1.7} />
              </button>
            </>
          ) : (
            <Link className="header-signin" to="/login">
              <UserRound size={16} strokeWidth={1.7} />
              <span>Sign in</span>
            </Link>
          )}

          <a className="button button--dark header-book" href="/#rooms">
            <span>Book a stay</span>
            <ArrowUpRight size={16} />
          </a>
        </div>

        <button
          className="mobile-menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navigation.map((item) => (
            <a href={item.href} key={item.label} onClick={closeMenu}>
              {item.label}
            </a>
          ))}

          <button
            className="mobile-nav__theme"
            type="button"
            role="switch"
            aria-checked={theme === "dark"}
            onClick={toggleTheme}
          >
            <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
            <span
              className={`theme-toggle ${theme === "dark" ? "is-dark" : ""}`}
              aria-hidden="true"
            >
              {themeSwitch}
            </span>
          </button>

          {isAuthenticated && user && dashboard ? (
            <>
              <Link to={dashboard.href} onClick={closeMenu}>
                <UserRound size={16} />
                {dashboard.label}
              </Link>

              <button
                className="mobile-nav__logout"
                type="button"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" onClick={closeMenu}>
              Sign in
            </Link>
          )}

          <a
            className="button button--dark"
            href="/#rooms"
            onClick={closeMenu}
          >
            Book a stay <ArrowUpRight size={16} />
          </a>
        </nav>
      )}
    </header>
  );
}
