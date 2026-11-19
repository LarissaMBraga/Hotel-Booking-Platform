import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  Star,
  Users,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { formatCurrency } from "@/lib/utils";
import type { Booking, Review, Room } from "@/types";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import "./RoomDetailsPage.css";

const fallbackGallery = [
  "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1000&q=85",
];

function getLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getNights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;

  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  const difference = end.getTime() - start.getTime();

  return difference > 0
    ? Math.round(difference / (1000 * 60 * 60 * 24))
    : 0;
}

function getRoomGallery(room: Room) {
  return room.images?.length
    ? room.images.filter(Boolean)
    : fallbackGallery;
}

function hasDateConflict(
  roomId: string,
  checkIn: string,
  checkOut: string,
  bookings: Booking[],
) {
  return bookings.some(
    (booking) =>
      booking.roomId === roomId &&
      booking.status !== "cancelled" &&
      booking.checkIn < checkOut &&
      booking.checkOut > checkIn,
  );
}

async function fetchRoomDetails(roomId: string) {
  const [roomResponse, bookingsResponse, reviewsResponse] = await Promise.all([
    api.get<Room>(`/rooms/${roomId}`),
    api.get<Booking[]>("/bookings"),
    api.get<Review[]>("/reviews"),
  ]);

  return {
    room: roomResponse.data,
    bookings: bookingsResponse.data,
    reviews: reviewsResponse.data,
  };
}

export function RoomDetailsPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [checkIn, setCheckIn] = useState(searchParams.get("checkIn") || "");
  const [checkOut, setCheckOut] = useState(searchParams.get("checkOut") || "");
  const [guests, setGuests] = useState(
    Math.max(1, Number(searchParams.get("guests")) || 1),
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["room-details", roomId],
    queryFn: () => fetchRoomDetails(roomId!),
    enabled: Boolean(roomId),
    retry: false,
  });

  const room = data?.room;
  const bookings = data?.bookings ?? [];
  const reviews = (data?.reviews ?? [])
    .filter((review) => review.roomId === roomId)
    .sort(
      (first, second) =>
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime(),
    );
  const gallery = room ? getRoomGallery(room) : [];
  const nights = getNights(checkIn, checkOut);
  const subtotal = room ? nights * room.pricePerNight : 0;

  const datesAreValid =
    Boolean(checkIn && checkOut) &&
    checkIn >= getLocalDate() &&
    checkOut > checkIn;

  const roomIsBlocked =
    room?.status === "cleaning" || room?.status === "occupied";

  const hasConflict =
    Boolean(room && datesAreValid) &&
    hasDateConflict(roomId || "", checkIn, checkOut, bookings);

  const isAvailable =
    Boolean(room && datesAreValid) &&
    !roomIsBlocked &&
    !hasConflict;

  function handleBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!room || !isAvailable) return;

    const params = new URLSearchParams({
      roomId: room.id,
      checkIn,
      checkOut,
      guests: String(guests),
    });

    navigate(`/booking?${params.toString()}`);
  }

  if (isLoading) {
    return (
      <>
        <SiteHeader />
        <main className="room-detail-state">
          <span className="room-detail-eyebrow">THE COLLECTION</span>
          <div className="room-detail-skeleton room-detail-skeleton--title" />
          <div className="room-detail-skeleton room-detail-skeleton--gallery" />
          <div className="room-detail-skeleton room-detail-skeleton--content" />
        </main>
        <SiteFooter />
      </>
    );
  }

  if (isError || !room) {
    return (
      <>
        <SiteHeader />
        <main className="room-detail-state">
          <span className="room-detail-eyebrow">THE COLLECTION</span>
          <h1>We couldn't find this room.</h1>
          <p>
            The accommodation may no longer be available or the link may be
            incorrect.
          </p>
          <button
            className="room-detail-back-button"
            type="button"
            onClick={() => navigate("/rooms")}
          >
            <ArrowLeft size={16} />
            Back to all rooms
          </button>
          <button
            className="room-detail-retry"
            type="button"
            onClick={() => void refetch()}
          >
            Try again
          </button>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="room-detail-page">
        <div className="room-detail-container">
          <Link className="room-detail-back" to="/rooms">
            <ArrowLeft size={15} />
            Back to the collection
          </Link>

          <section className="room-detail-heading">
            <div>
              <span className="room-detail-eyebrow">
                MAISON COLLECTION / {room.type.toUpperCase()}
              </span>
              <h1>{room.name}</h1>
              <p>{room.description}</p>
            </div>

            <div className="room-detail-rating">
              <Star size={16} fill="currentColor" />
              <strong>{room.rating.toFixed(1)}</strong>
              <span>({room.reviewCount} reviews)</span>
            </div>
          </section>

          <section
            className={`room-detail-gallery room-detail-gallery--${Math.min(
              gallery.length,
              3,
            )}`}
            aria-label={`${room.name} photo gallery`}
          >
            {gallery.slice(0, 3).map((image, index) => (
              <div
                className={`room-detail-gallery__item room-detail-gallery__item--${index + 1}`}
                key={`${image}-${index}`}
              >
                <img
                  src={image}
                  alt={`${room.name} - view ${index + 1}`}
                  loading={index === 0 ? "eager" : "lazy"}
                />
              </div>
            ))}
          </section>

          <div className="room-detail-layout">
            <div className="room-detail-information">
              <section className="room-detail-overview">
                <span className="room-detail-eyebrow">YOUR STAY</span>
                <h2>A little more room to unwind.</h2>
                <p>
                  Every detail has been considered to make your stay feel
                  effortless. Settle in, slow down and enjoy a space designed
                  around comfort, privacy and thoughtful hospitality.
                </p>

                <div className="room-detail-highlights">
                  <div>
                    <Users size={19} />
                    <span>Up to {room.capacity} guests</span>
                  </div>
                  <div>
                    <CalendarDays size={19} />
                    <span>Flexible stay dates</span>
                  </div>
                  <div>
                    <Star size={19} />
                    <span>{room.rating.toFixed(1)} guest rating</span>
                  </div>
                </div>
              </section>

              <section className="room-detail-amenities">
                <span className="room-detail-eyebrow">THOUGHTFUL DETAILS</span>
                <h2>Designed for your comfort.</h2>

                <div className="room-detail-amenities__grid">
                  {room.amenities.map((amenity) => (
                    <div className="room-detail-amenity" key={amenity}>
                      <Check size={16} />
                      <span>{amenity}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="room-detail-reviews">
                <div className="room-detail-reviews__heading">
                  <div>
                    <span className="room-detail-eyebrow">GUEST STORIES</span>
                    <h2>Words from our guests.</h2>
                    <p>Discover what guests have loved about their MAISON experience.</p>
                  </div>
                  <div className="room-detail-reviews__summary">
                    <Star size={18} fill="currentColor" />
                    <strong>{room.rating.toFixed(1)}</strong>
                    <span>{room.reviewCount} guest reviews</span>
                  </div>
                </div>

                {reviews.length > 0 ? (
                  <div className="room-detail-reviews__list">
                    {reviews.map((review) => (
                      <article className="room-detail-review" key={review.id}>
                        <div className="room-detail-review__top">
                          <div>
                            <h3>{review.guestName}</h3>
                            <time dateTime={review.createdAt}>
                              {new Date(review.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </time>
                          </div>
                          <div
                            className="room-detail-review__stars"
                            aria-label={`${review.rating} out of 5 stars`}
                          >
                            {Array.from({ length: 5 }, (_, index) => (
                              <Star
                                key={index}
                                size={14}
                                fill={index < review.rating ? "currentColor" : "none"}
                              />
                            ))}
                          </div>
                        </div>
                        <p>{review.comment}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="room-detail-reviews__empty">
                    No written reviews yet. Be the first to share your experience.
                  </p>
                )}
              </section>
              <section className="room-detail-note">
                <span className="room-detail-note__mark">M</span>
                <div>
                  <h3>The MAISON experience</h3>
                  <p>
                    Considered spaces, attentive service and the freedom to
                    make every stay your own.
                  </p>
                </div>
              </section>
            </div>

            <aside className="room-detail-booking">
              <div className="room-detail-booking__price">
                <span>From</span>
                <strong>{formatCurrency(room.pricePerNight)}</strong>
                <span>/ night</span>
              </div>

              <form onSubmit={handleBooking}>
                <div className="room-detail-field">
                  <label htmlFor="room-check-in">Check-in</label>
                  <input
                    id="room-check-in"
                    type="date"
                    min={getLocalDate()}
                    value={checkIn}
                    onClick={(event) => event.currentTarget.showPicker()}
                    onChange={(event) => setCheckIn(event.target.value)}
                    required
                  />
                </div>

                <div className="room-detail-field">
                  <label htmlFor="room-check-out">Check-out</label>
                  <input
                    id="room-check-out"
                    type="date"
                    min={checkIn || getLocalDate()}
                    value={checkOut}
                    onClick={(event) => event.currentTarget.showPicker()}
                    onChange={(event) => setCheckOut(event.target.value)}
                    required
                  />
                </div>

                <div className="room-detail-field">
                  <label htmlFor="room-guests">Guests</label>
                  <select
                    id="room-guests"
                    value={guests}
                    onChange={(event) => setGuests(Number(event.target.value))}
                  >
                    {Array.from(
                      { length: room.capacity },
                      (_, index) => index + 1,
                    ).map((count) => (
                      <option value={count} key={count}>
                        {count} {count === 1 ? "guest" : "guests"}
                      </option>
                    ))}
                  </select>
                </div>

                {checkIn && checkOut && !datesAreValid && (
                  <p className="room-detail-availability room-detail-availability--error">
                    Please select valid dates. Check-out must be after
                    check-in.
                  </p>
                )}

                {datesAreValid && hasConflict && (
                  <p className="room-detail-availability room-detail-availability--error">
                    This room is already reserved for the selected dates.
                    Please choose another period.
                  </p>
                )}

                {datesAreValid && roomIsBlocked && (
                  <p className="room-detail-availability room-detail-availability--error">
                    This room is currently unavailable.
                  </p>
                )}

                {isAvailable && (
                  <p className="room-detail-availability room-detail-availability--success">
                    <Check size={15} />
                    Available for your selected dates
                  </p>
                )}

                {nights > 0 && (
                  <div className="room-detail-price-summary">
                    <div>
                      <span>
                        {formatCurrency(room.pricePerNight)} Ã— {nights} nights
                      </span>
                      <strong>{formatCurrency(subtotal)}</strong>
                    </div>
                    <div className="room-detail-price-summary__total">
                      <span>Estimated total</span>
                      <strong>{formatCurrency(subtotal)}</strong>
                    </div>
                  </div>
                )}

                <button
                  className="room-detail-book-button"
                  type="submit"
                  disabled={!isAvailable}
                >
                  Continue to booking
                  <ArrowUpRight size={17} />
                </button>

                <p className="room-detail-booking__footnote">
                  No payment is required at this stage.
                </p>
              </form>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

