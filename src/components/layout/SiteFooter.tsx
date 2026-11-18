
import { ArrowUp, ArrowUpRight, GitBranch } from "lucide-react";
import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__main">
        <div className="site-footer__brand-column">
          <Link className="brand brand--footer" to="/">
            <span className="brand__name">MAISON</span>
            <span className="brand__caption">HOTELS & RESIDENCES</span>
          </Link>

          <p className="site-footer__description">
            Thoughtful stays, considered details, and places that make every
            journey feel a little more like home.
          </p>
        </div>

        <div className="site-footer__column">
          <h2>Explore</h2>
          <a href="/#rooms">Our rooms</a>
          <a href="/#story">Our story</a>
          <Link to="/my-bookings">My bookings</Link>
        </div>

        <div className="site-footer__column">
          <h2>Assistance</h2>
          <a href="mailto:hello@maison.example">Contact us</a>
          <a href="mailto:hello@maison.example">Help & support</a>
          <a href="/#faq">Frequently asked questions</a>
        </div>

        <div className="site-footer__column site-footer__newsletter">
          <h2>Stay in the know</h2>
          <p>Discover considered escapes and thoughtful experiences.</p>
          <a className="footer-text-link" href="mailto:hello@maison.example">
            Get in touch <ArrowUpRight size={15} />
          </a>
        </div>
      </div>

      <div className="site-footer__bottom">
        <span>
          © {new Date().getFullYear()} Maison Hotels & Residences
        </span>

        <div className="site-footer__credits">
          <span>
            Designed & developed by <strong>Larissa Moreira Braga</strong>
          </span>

          <a
            className="site-footer__github"
            href="https://github.com/LarissaMBraga/Hotel-Booking-Platform"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Maison project on GitHub"
          >
            <GitBranch  size={15} />
            <span>GitHub</span>
            <ArrowUpRight size={13} />
          </a>
        </div>

        <button
          className="site-footer__back-to-top"
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
        >
          <span>Back to top</span>
          <ArrowUp size={14} />
        </button>
      </div>
    </footer>
  );
}
