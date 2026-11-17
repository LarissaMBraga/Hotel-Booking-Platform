import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Room } from "@/types";
import { RoomCard } from "@/components/booking/RoomCard";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";

const API_URL = "http://localhost:3001";

async function fetchRooms(): Promise<Room[]> {
  const response = await fetch(`${API_URL}/rooms`);

  if (!response.ok) {
    throw new Error("Unable to load rooms. Please try again.");
  }

  return response.json();
}

export function HomePage() {
  const [guests, setGuests] = useState("2");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  const {
    data: rooms = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["rooms"],
    queryFn: fetchRooms,
    staleTime: 60_000,
  });

  const featuredRooms = useMemo(
    () =>
      rooms
        .filter((room) => room.status === "available")
        .slice(0, 3),
    [rooms],
  );

  const today = new Date().toISOString().split("T")[0];

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams();

    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);

    params.set("guests", guests);

    window.location.href = `/rooms?${params.toString()}`;
  }

  return (
    <>
      <SiteHeader />

      <main>
        <section className="maison-hero">
          <div className="maison-hero__image" />
          <div className="maison-hero__overlay" />

          <div className="maison-hero__content">
            <span className="maison-eyebrow maison-hero__eyebrow">
              A different kind of hospitality
            </span>

            <h1>
              Somewhere
              <br />
              <em>worth</em> staying.
            </h1>

            <p>
              Discover thoughtfully designed spaces, meaningful experiences
              and the quiet luxury of feeling at home.
            </p>

            <a className="maison-hero__link" href="#rooms">
              Discover our rooms
              <ArrowRight size={17} />
            </a>
          </div>

          <div className="maison-hero__index">
            <span>01</span>
            <span className="maison-hero__index-line" />
            <span>03</span>
          </div>

          <span className="maison-hero__location">
            <MapPin size={14} />
            Exceptional stays, everywhere
          </span>
        </section>

        <section className="maison-search-section">
          <form className="maison-search" onSubmit={handleSearch}>
            <label className="maison-search__field">
              <span className="maison-search__label">
                <MapPin size={15} /> Destination
              </span>
              <span className="maison-search__value">
                Discover our collection
              </span>
            </label>

            <label className="maison-search__field">
              <span className="maison-search__label">
                <CalendarDays size={15} /> Check in
              </span>
              <input
                aria-label="Check-in date"
                type="date"
                min={today}
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
                required
              />
            </label>

            <label className="maison-search__field">
              <span className="maison-search__label">
                <CalendarDays size={15} /> Check out
              </span>
              <input
                aria-label="Check-out date"
                type="date"
                min={checkIn || today}
                value={checkOut}
                onChange={(event) => setCheckOut(event.target.value)}
                required
              />
            </label>

            <label className="maison-search__field">
              <span className="maison-search__label">
                <Users size={15} /> Guests
              </span>
              <select
                aria-label="Number of guests"
                value={guests}
                onChange={(event) => setGuests(event.target.value)}
              >
                <option value="1">1 guest</option>
                <option value="2">2 guests</option>
                <option value="3">3 guests</option>
                <option value="4">4 guests</option>
                <option value="5">5 guests</option>
                <option value="6">6 guests</option>
              </select>
            </label>

            <button className="maison-search__button" type="submit">
              <Search size={18} />
              <span>Search</span>
            </button>
          </form>
        </section>

        <section className="maison-intro" id="story">
          <div className="maison-intro__side">
            <span className="maison-eyebrow">The Maison philosophy</span>
            <span className="maison-intro__number">01 / 03</span>
          </div>

          <div className="maison-intro__main">
            <h2>
              Not just a place
              <br />
              to sleep. A place
              <br />
              <em>to belong.</em>
            </h2>
            <div className="maison-intro__bottom">
              <p>
                We believe the best journeys are made of little things.
                A welcoming space, thoughtful details and the freedom to
                experience every destination your own way.
              </p>
              <a href="#rooms" className="maison-text-link">
                Get to know us <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        </section>

        <section className="maison-rooms" id="rooms">
          <div className="maison-section-heading">
            <div>
              <span className="maison-eyebrow">Find your place</span>
              <h2>Rooms made for <em>living.</em></h2>
            </div>

            <Link className="maison-text-link" to="/rooms">
              Explore all rooms <ArrowUpRight size={16} />
            </Link>
          </div>

          {isLoading && (
            <div className="maison-room-grid" aria-label="Loading rooms">
              {[1, 2, 3].map((item) => (
                <div className="maison-room-skeleton" key={item}>
                  <div />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          )}

          {isError && (
            <div className="maison-state">
              <p>Our rooms are temporarily unavailable.</p>
              <button type="button" onClick={() => refetch()}>
                Try again <ArrowRight size={15} />
              </button>
            </div>
          )}

          {!isLoading && !isError && featuredRooms.length > 0 && (
            <div className="maison-room-grid">
              {featuredRooms.map((room) => (
                <RoomCard room={room} key={room.id} />
              ))}
            </div>
          )}

          {!isLoading && !isError && featuredRooms.length === 0 && (
            <div className="maison-state">
              <p>No available rooms at the moment. Please check back soon.</p>
            </div>
          )}
        </section>

        <section className="maison-experience">
          <div className="maison-experience__image" />
          <div className="maison-experience__content">
            <span className="maison-eyebrow">The art of staying well</span>
            <h2>
              Thoughtful
              <br />
              by <em>nature.</em>
            </h2>
            <p>
              From the first welcome to the last little detail, everything
              is considered so you can simply enjoy being here.
            </p>

            <div className="maison-experience__features">
              <span><Sparkles size={16} /> Considered comfort</span>
              <span><ShieldCheck size={16} /> A stay you can trust</span>
            </div>

            <a className="maison-experience__link" href="#rooms">
              Find your stay <ArrowUpRight size={17} />
            </a>
          </div>
        </section>

        <section className="maison-quote">
          <span className="maison-eyebrow">A note from Maison</span>
          <blockquote>
            “Luxury is not about having more.
            <br />
            It is about feeling <em>more.</em>”
          </blockquote>
          <span className="maison-quote__signature">The Maison experience</span>
        </section>

        <section className="maison-cta">
          <div>
            <span className="maison-eyebrow">Your next chapter starts here</span>
            <h2>Make room for <em>something wonderful.</em></h2>
          </div>
          <Link to="/#rooms" className="maison-cta__button">
            Explore our rooms <ArrowUpRight size={17} />
          </Link>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
