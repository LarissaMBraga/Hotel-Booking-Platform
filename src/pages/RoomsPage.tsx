import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Filter,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/services/api";
import { RoomCard } from "@/components/booking/RoomCard";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import type { Booking, Room } from "@/types";
import "./RoomsPage.css";

type SortOption = "recommended" | "price-low" | "price-high" | "rating";

type PriceRange = "all" | "under-250" | "250-400" | "over-400";

async function fetchRooms(): Promise<Room[]> {
  const response = await api.get<Room[]>("/rooms");
  return response.data;
}

async function fetchBookings(): Promise<Booking[]> {
  const response = await api.get<Booking[]>("/bookings");
  return response.data;
}

function getLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function hasDateConflict(
  roomId: string,
  checkIn: string,
  checkOut: string,
  bookings: Booking[],
) {
  return bookings.some((booking) => {
    if (booking.roomId !== roomId || booking.status === "cancelled") {
      return false;
    }

    return booking.checkIn < checkOut && booking.checkOut > checkIn;
  });
}

export function RoomsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [checkIn, setCheckIn] = useState(
    () => searchParams.get("checkIn") ?? "",
  );
  const [checkOut, setCheckOut] = useState(
    () => searchParams.get("checkOut") ?? "",
  );
  const [guests, setGuests] = useState(
    () => searchParams.get("guests") ?? "2",
  );
  const [roomType, setRoomType] = useState("all");
  const [priceRange, setPriceRange] = useState<PriceRange>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [searchError, setSearchError] = useState("");

  const {
    data: rooms = [],
    isLoading: roomsLoading,
    isError: roomsError,
    refetch: refetchRooms,
  } = useQuery({
    queryKey: ["rooms"],
    queryFn: fetchRooms,
    staleTime: 60_000,
  });

  const {
    data: bookings = [],
    isLoading: bookingsLoading,
    isError: bookingsError,
    refetch: refetchBookings,
  } = useQuery({
    queryKey: ["bookings"],
    queryFn: fetchBookings,
    staleTime: 30_000,
  });

  const loading = roomsLoading || bookingsLoading;
  const hasError = roomsError || bookingsError;
  const validDateRange = Boolean(
    checkIn && checkOut && checkOut > checkIn,
  );

  const availableRooms = useMemo(() => {
    const guestCount = Number(guests);

    const filtered = rooms.filter((room) => {
      if (room.status === "cleaning" || room.status === "occupied") {
        return false;
      }

      if (room.capacity < guestCount) {
        return false;
      }

      if (validDateRange) {
        if (hasDateConflict(room.id, checkIn, checkOut, bookings)) {
          return false;
        }
      } else if (room.status !== "available") {
        return false;
      }

      if (roomType !== "all" && room.type !== roomType) {
        return false;
      }

      if (
        priceRange === "under-250" &&
        room.pricePerNight >= 250
      ) {
        return false;
      }

      if (
        priceRange === "250-400" &&
        (room.pricePerNight < 250 || room.pricePerNight > 400)
      ) {
        return false;
      }

      if (
        priceRange === "over-400" &&
        room.pricePerNight <= 400
      ) {
        return false;
      }

      return true;
    });

    switch (sortBy) {
      case "price-low":
        return filtered.sort(
          (first, second) => first.pricePerNight - second.pricePerNight,
        );
      case "price-high":
        return filtered.sort(
          (first, second) => second.pricePerNight - first.pricePerNight,
        );
      case "rating":
        return filtered.sort(
          (first, second) => second.rating - first.rating,
        );
      default:
        return filtered.sort(
          (first, second) => second.rating - first.rating,
        );
    }
  }, [
    rooms,
    bookings,
    guests,
    checkIn,
    checkOut,
    validDateRange,
    roomType,
    priceRange,
    sortBy,
  ]);

  const roomTypes = useMemo(
    () => Array.from(new Set(rooms.map((room) => room.type))),
    [rooms],
  );

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchError("");

    if (checkIn && checkOut && checkOut <= checkIn) {
      setSearchError("Check-out must be later than check-in.");
      return;
    }

    if (checkIn && checkIn < getLocalDate()) {
      setSearchError("Check-in cannot be in the past.");
      return;
    }

    const params = new URLSearchParams();

    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);

    params.set("guests", guests);
    setSearchParams(params);
  }

  function clearFilters() {
    setRoomType("all");
    setPriceRange("all");
    setSortBy("recommended");
  }

  function clearSearch() {
    setCheckIn("");
    setCheckOut("");
    setGuests("2");
    setSearchError("");
    setSearchParams({});
  }

  const activeFilters =
    roomType !== "all" || priceRange !== "all";

  return (
    <>
      <SiteHeader />

      <main className="rooms-page">
        <section className="rooms-hero">
          <div className="rooms-hero__breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <span>Our rooms</span>
          </div>

          <div className="rooms-hero__content">
            <span className="maison-eyebrow">The Maison collection</span>
            <h1>
              Find your place
              <br />
              <em>to belong.</em>
            </h1>
            <p>
              A considered collection of spaces, each with its own
              character and all designed around the art of staying well.
            </p>
          </div>

          <span className="rooms-hero__index">01 â€” THE COLLECTION</span>
        </section>

        <section className="rooms-search-section">
          <form className="rooms-search" onSubmit={handleSearch}>
            <label className="rooms-search__field">
              <span>
                <CalendarDays size={15} />
                Check in
              </span>
              <input
                type="date"
                aria-label="Check-in date"
                min={getLocalDate()}
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
              />
            </label>

            <label className="rooms-search__field">
              <span>
                <CalendarDays size={15} />
                Check out
              </span>
              <input
                type="date"
                aria-label="Check-out date"
                min={checkIn || getLocalDate()}
                value={checkOut}
                onChange={(event) => setCheckOut(event.target.value)}
              />
            </label>

            <label className="rooms-search__field">
              <span>
                <Users size={15} />
                Guests
              </span>
              <select
                aria-label="Number of guests"
                value={guests}
                onChange={(event) => setGuests(event.target.value)}
              >
                {[1, 2, 3, 4, 5, 6].map((count) => (
                  <option value={count} key={count}>
                    {count} {count === 1 ? "guest" : "guests"}
                  </option>
                ))}
              </select>
            </label>

            <button className="rooms-search__button" type="submit">
              <Search size={17} />
              Update search
            </button>
          </form>

          {searchError && (
            <p className="rooms-search__error" role="alert">
              {searchError}
            </p>
          )}
        </section>

        <section className="rooms-results">
          <div className="rooms-results__heading">
            <div>
              <span className="maison-eyebrow">Your next stay</span>
              <h2>Explore our <em>spaces.</em></h2>
              <p>
                {validDateRange
                  ? `Available for ${checkIn} to ${checkOut}`
                  : "Discover a space that feels like yours."}
              </p>
            </div>

            <span className="rooms-results__count">
              {loading ? "Loading..." : `${availableRooms.length} spaces`}
            </span>
          </div>

          <div className="rooms-toolbar">
            <div className="rooms-toolbar__filters">
              <span className="rooms-toolbar__label">
                <SlidersHorizontal size={15} />
                Refine by
              </span>

              <label className="rooms-filter">
                <span className="sr-only">Room category</span>
                <select
                  value={roomType}
                  onChange={(event) => setRoomType(event.target.value)}
                >
                  <option value="all">All categories</option>
                  {roomTypes.map((type) => (
                    <option value={type} key={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="rooms-filter">
                <span className="sr-only">Price range</span>
                <select
                  value={priceRange}
                  onChange={(event) =>
                    setPriceRange(event.target.value as PriceRange)
                  }
                >
                  <option value="all">All prices</option>
                  <option value="under-250">Under $250</option>
                  <option value="250-400">$250 â€“ $400</option>
                  <option value="over-400">Over $400</option>
                </select>
              </label>

              {activeFilters && (
                <button
                  className="rooms-toolbar__clear"
                  type="button"
                  onClick={clearFilters}
                >
                  <X size={13} />
                  Clear filters
                </button>
              )}
            </div>

            <label className="rooms-sort">
              <ArrowDownWideNarrow size={15} />
              <span>Sort by</span>
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as SortOption)
                }
              >
                <option value="recommended">Recommended</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="rating">Top rated</option>
              </select>
            </label>
          </div>

          {loading && (
            <div className="rooms-grid" aria-label="Loading rooms">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div className="rooms-skeleton" key={item}>
                  <div className="rooms-skeleton__image" />
                  <div className="rooms-skeleton__line" />
                  <div className="rooms-skeleton__line rooms-skeleton__line--short" />
                </div>
              ))}
            </div>
          )}

          {hasError && !loading && (
            <div className="rooms-state">
              <span className="rooms-state__icon">
                <Filter size={22} />
              </span>
              <h3>We couldn't load the collection.</h3>
              <p>
                Something interrupted the connection. Please try again.
              </p>
              <button
                type="button"
                onClick={() => {
                  void refetchRooms();
                  void refetchBookings();
                }}
              >
                Try again <ArrowRight size={15} />
              </button>
            </div>
          )}

          {!loading && !hasError && availableRooms.length > 0 && (
            <div className="rooms-grid">
              {availableRooms.map((room) => (
                <RoomCard room={room} key={room.id} />
              ))}
            </div>
          )}

          {!loading && !hasError && availableRooms.length === 0 && (
            <div className="rooms-state">
              <span className="rooms-state__icon">
                <Search size={22} />
              </span>
              <h3>No spaces found just yet.</h3>
              <p>
                Try adjusting your dates or filters to discover more
                possibilities.
              </p>
              <div className="rooms-state__actions">
                <button type="button" onClick={clearFilters}>
                  Clear filters <Check size={15} />
                </button>
                <button
                  className="rooms-state__secondary"
                  type="button"
                  onClick={clearSearch}
                >
                  Reset search <ArrowLeft size={15} />
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rooms-note">
          <span className="maison-eyebrow">A little more than a room</span>
          <p>
            Every Maison stay is an invitation to slow down, settle in
            and make the space your own.
          </p>
          <span className="rooms-note__signature">The Maison experience</span>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
