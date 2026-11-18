import { useState } from "react";
import "./SiteLayout.css";
import { Link } from "react-router-dom";
import { ArrowUpRight, Menu, UserRound, X } from "lucide-react";

const navigation = [
  { label: "Home", href: "/" },
  { label: "Our rooms", href: "/#rooms" },
  { label: "Our story", href: "/#story" },
];

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" to="/" aria-label="Maison Hotels home" onClick={closeMenu}>
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
          <Link className="header-signin" to="/login">
            <UserRound size={16} strokeWidth={1.7} />
            <span>Sign in</span>
          </Link>
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
          <Link to="/login" onClick={closeMenu}>Sign in</Link>
          <a className="button button--dark" href="/#rooms" onClick={closeMenu}>
            Book a stay <ArrowUpRight size={16} />
          </a>
        </nav>
      )}
    </header>
  );
}
