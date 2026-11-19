import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/services/api";
import { hasDateConflict } from "@/lib/booking-utils";
import { RoomCard } from "@/components/booking/RoomCard";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import type { Booking, Room } from "@/types";
import "./RoomsPage.css";

type SortOption = "recommended" | "price-low" | "price-high" | "rating";

const MIN_PRICE = 0;
const MAX_PRICE = 700;
const PAGE_SIZE = 4;

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

function getNumberParam(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const [roomType, setRoomType] = useState(
    () => searchParams.get("type") ?? "all",
  );
  const [minPrice, setMinPrice] = useState(() =>
    Math.max(MIN_PRICE, getNumberParam(searchParams.get("minPrice"), MIN_PRICE)),
  );
  const [maxPrice, setMaxPrice] = useState(() =>
    Math.min(MAX_PRICE, getNumberParam(searchParams.get("maxPrice"), MAX_PRICE)),
  );
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const value = searchParams.get("sort");
    return value === "price-low" ||
      value === "price-high" ||
      value === "rating"
      ? value
      : "recommended";
  });
  const [currentPage, setCurrentPage] = useState(() =>
    Math.max(1, getNumberParam(searchParams.get("page"), 1)),
  );
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

      if (room.pricePerNight < minPrice || room.pricePerNight > maxPrice) {
        return false;
      }

      return true;
    });

    return filtered.sort((first, second) => {
      switch (sortBy) {
        case "price-low":
          return first.pricePerNight - second.pricePerNight;
        case "price-high":
          return second.pricePerNight - first.pricePerNight;
        case "rating":
          return second.rating - first.rating;
        default:
          return second.rating - first.rating;
      }
    });
  }, [
    rooms,
    bookings,
    guests,
    checkIn,
    checkOut,
    validDateRange,
    roomType,
    minPrice,
    maxPrice,
    sortBy,
  ]);

  const roomTypes = useMemo(
    () => Array.from(new Set(rooms.map((room) => room.type))),
    [rooms],
  );

  const totalPages = Math.max(1, Math.ceil(availableRooms.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRooms = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return availableRooms.slice(startIndex, startIndex + PAGE_SIZE);
  }, [availableRooms, safeCurrentPage]);

  function updateUrl(patch: Record<string, string | null>) {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === "") {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    });

    setSearchParams(nextParams, { replace: true });
  }

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

    setCurrentPage(1);
    updateUrl({
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      guests,
      page: null,
    });
  }

  function handleRoomTypeChange(value: string) {
    setRoomType(value);
    setCurrentPage(1);
    updateUrl({ type: value === "all" ? null : value, page: null });
  }

  function handlePriceChange(nextMin: number, nextMax: number) {
    const safeMin = Math.min(nextMin, nextMax);
    const safeMax = Math.max(nextMin, nextMax);

    setMinPrice(safeMin);
    setMaxPrice(safeMax);
    setCurrentPage(1);
    updateUrl({
      minPrice: safeMin === MIN_PRICE ? null : String(safeMin),
      maxPrice: safeMax === MAX_PRICE ? null : String(safeMax),
      page: null,
    });
  }

  function handleSortChange(value: SortOption) {
    setSortBy(value);
    setCurrentPage(1);
    updateUrl({
      sort: value === "recommended" ? null : value,
      page: null,
    });
  }

  function handlePageChange(page: number) {
    const nextPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(nextPage);
    updateUrl({
      page: nextPage === 1 ? null : String(nextPage),
    });
    document.querySelector(".rooms-results")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function clearFilters() {
    setRoomType("all");
    setMinPrice(MIN_PRICE);
    setMaxPrice(MAX_PRICE);
    setSortBy("recommended");
    setCurrentPage(1);
    updateUrl({
      type: null,
      minPrice: null,
      maxPrice: null,
      sort: null,
      page: null,
    });
  }

  function clearSearch() {
    setCheckIn("");
    setCheckOut("");
    setGuests("2");
    setSearchError("");
    setCurrentPage(1);
    setSearchParams({});
    clearFilters();
  }

  const activeFilters =
    roomType !== "all" ||
    minPrice !== MIN_PRICE ||
    maxPrice !== MAX_PRICE;

  const firstVisibleRoom =
    availableRooms.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const lastVisibleRoom = Math.min(
    safeCurrentPage * PAGE_SIZE,
    availableRooms.length,
  );

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

          <span className="rooms-hero__index">01 — THE COLLECTION</span>
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
                  onChange={(event) => handleRoomTypeChange(event.target.value)}
                >
                  <option value="all">All categories</option>
                  {roomTypes.map((type) => (
                    <option value={type} key={type}>
                      {type}
                    </option>
                  ))}
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
                  handleSortChange(event.target.value as SortOption)
                }
              >
                <option value="recommended">Recommended</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="rating">Top rated</option>
              </select>
            </label>
          </div>

          <section className="rooms-price-filter" aria-label="Price filter">
            <div className="rooms-price-filter__heading">
              <div>
                <span className="rooms-price-filter__eyebrow">Your budget</span>
                <h3>Price per night</h3>
              </div>
              <span className="rooms-price-filter__value">
                ${minPrice} – ${maxPrice === MAX_PRICE ? `${MAX_PRICE}+` : maxPrice}
              </span>
            </div>

            <div className="rooms-price-filter__sliders">
              <label>
                <span>Minimum price: ${minPrice}</span>
                <input
                  type="range"
                  min={MIN_PRICE}
                  max={MAX_PRICE}
                  step={10}
                  value={minPrice}
                  aria-label="Minimum price per night"
                  onChange={(event) =>
                    handlePriceChange(Number(event.target.value), maxPrice)
                  }
                />
              </label>
              <label>
                <span>Maximum price: ${maxPrice}</span>
                <input
                  type="range"
                  min={MIN_PRICE}
                  max={MAX_PRICE}
                  step={10}
                  value={maxPrice}
                  aria-label="Maximum price per night"
                  onChange={(event) =>
                    handlePriceChange(minPrice, Number(event.target.value))
                  }
                />
              </label>
            </div>
          </section>

          {loading && (
            <div className="rooms-grid" aria-label="Loading rooms">
              {[1, 2, 3, 4].map((item) => (
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
            <>
              <div className="rooms-pagination__summary" aria-live="polite">
                Showing {firstVisibleRoom}–{lastVisibleRoom} of{" "}
                {availableRooms.length} spaces
              </div>

              <div className="rooms-grid">
                {paginatedRooms.map((room) => (
                  <RoomCard room={room} key={room.id} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav className="rooms-pagination" aria-label="Room pages">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={safeCurrentPage === 1}
                    onClick={() => handlePageChange(safeCurrentPage - 1)}
                  >
                    <ChevronLeft size={17} />
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                    (page) => (
                      <button
                        type="button"
                        key={page}
                        aria-label={`Page ${page}`}
                        aria-current={page === safeCurrentPage ? "page" : undefined}
                        className={
                          page === safeCurrentPage
                            ? "rooms-pagination__active"
                            : ""
                        }
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    ),
                  )}

                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={safeCurrentPage === totalPages}
                    onClick={() => handlePageChange(safeCurrentPage + 1)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </nav>
              )}
            </>
          )}

          {!loading && !hasError && availableRooms.length === 0 && (
            <div className="rooms-state">
              <span className="rooms-state__icon">
                <Search size={22} />
              </span>
              <h3>No spaces found just yet.</h3>
              <p>
                Try adjusting your dates, guest count or filters to discover
                more possibilities.
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
