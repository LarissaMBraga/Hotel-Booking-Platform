import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  MapPin,
  Send,
  Star,
  XCircle,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth-store";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import type { Booking, Guest, Review, Room } from "@/types";
import "./DashboardPages.css";

interface BookingData {
  bookings: Booking[];
  guests: Guest[];
  rooms: Room[];
  reviews: Review[];
}

interface ReviewDraft {
  rating: number;
  comment: string;
}

interface SubmitReviewData {
  booking: Booking;
  rating: number;
  comment: string;
}

async function loadData(): Promise<BookingData> {
  const [bookings, guests, rooms, reviews] = await Promise.all([
    api.get<Booking[]>("/bookings"),
    api.get<Guest[]>("/guests"),
    api.get<Room[]>("/rooms"),
    api.get<Review[]>("/reviews"),
  ]);

  return {
    bookings: bookings.data,
    guests: guests.data,
    rooms: rooms.data,
    reviews: reviews.data,
  };
}

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const date = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function downloadInvoice(booking: Booking, room?: Room) {
  const document = new jsPDF();
  document.setFont("helvetica", "bold");
  document.setFontSize(24);
  document.text("MAISON", 20, 25);
  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.text("HOTELS & RESIDENCES", 20, 32);
  document.setFontSize(18);
  document.text("Reservation invoice", 20, 55);
  document.setFontSize(11);
  document.text(`Reference: ${booking.id}`, 20, 70);
  document.text(`Accommodation: ${room?.name ?? booking.roomId}`, 20, 82);
  document.text(`Check-in: ${date(booking.checkIn)}`, 20, 94);
  document.text(`Check-out: ${date(booking.checkOut)}`, 20, 106);
  document.text(`Status: ${booking.status}`, 20, 118);
  document.text(`Total: ${money(booking.totalPrice)}`, 20, 138);
  document.setFontSize(9);
  document.text("Thank you for choosing MAISON Hotels & Residences.", 20, 165);
  document.save(`maison-invoice-${booking.id}.pdf`);
}

export function MyBookingsPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, ReviewDraft>
  >({});

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["guest-bookings"],
    queryFn: loadData,
  });

  const guest = data?.guests.find(
    (item) =>
      item.email.toLowerCase() === user?.email.toLowerCase() ||
      item.name.toLowerCase() === user?.name.toLowerCase(),
  );

  const cancelMutation = useMutation({
    mutationFn: async (booking: Booking) => {
      await api.patch(`/bookings/${booking.id}`, { status: "cancelled" });
      const room = data?.rooms.find((item) => item.id === booking.roomId);
      if (room && room.status === "booked") {
        await api.patch(`/rooms/${room.id}`, { status: "available" });
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["guest-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["rooms"] }),
      ]);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ booking, rating, comment }: SubmitReviewData) => {
      if (booking.status !== "completed") {
        throw new Error("Only completed stays can be reviewed.");
      }

      if (!guest) {
        throw new Error("Guest information could not be found.");
      }

      const alreadyReviewed = data?.reviews.some(
        (review) => review.bookingId === booking.id,
      );

      if (alreadyReviewed) {
        throw new Error("This stay has already been reviewed.");
      }

      const review: Review = {
        id: `review-${Date.now()}`,
        bookingId: booking.id,
        guestId: guest.id,
        guestName: guest.name,
        roomId: booking.roomId,
        rating,
        comment: comment.trim(),
        createdAt: new Date().toISOString(),
      };

      const response = await api.post<Review>("/reviews", review);
      return response.data;
    },
    onSuccess: async (_, variables) => {
      setReviewDrafts((current) => ({
        ...current,
        [variables.booking.id]: { rating: 0, comment: "" },
      }));

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["guest-bookings"] }),
        queryClient.invalidateQueries({
          queryKey: ["room-details", variables.booking.roomId],
        }),
      ]);
    },
  });

  const bookings = useMemo(
    () =>
      (data?.bookings ?? [])
        .filter((booking) => booking.guestId === guest?.id)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
    [data?.bookings, guest?.id],
  );

  const upcoming = bookings.filter(
    (booking) =>
      booking.status === "confirmed" || booking.status === "checked-in",
  );

  const past = bookings.filter(
    (booking) =>
      booking.status === "completed" || booking.status === "cancelled",
  );

  const updateReviewDraft = (
    bookingId: string,
    changes: Partial<ReviewDraft>,
  ) => {
    setReviewDrafts((current) => ({
      ...current,
      [bookingId]: {
        rating: current[bookingId]?.rating ?? 0,
        comment: current[bookingId]?.comment ?? "",
        ...changes,
      },
    }));
  };

  return (
    <>
      <SiteHeader />
      <main className="dashboard-page">
        <header className="dashboard-hero">
          <span className="dashboard-eyebrow">GUEST EXPERIENCE</span>
          <h1>Your journeys<span>.</span></h1>
          <p>Every stay, thoughtfully brought together in one place.</p>
        </header>

        <section className="dashboard-content">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-eyebrow">YOUR MAISON ACCOUNT</span>
              <h2>Upcoming stays</h2>
            </div>
            <span className="dashboard-count">{upcoming.length} reservations</span>
          </div>

          {isLoading && <div className="dashboard-state">Loading your reservations...</div>}
          {isError && (
            <div className="dashboard-state" role="alert">
              We couldn't load your reservations.
              <button onClick={() => void refetch()}>Try again</button>
            </div>
          )}

          {!isLoading && !isError && upcoming.length === 0 && (
            <div className="dashboard-empty">
              <CalendarDays size={28} />
              <h3>Your next journey starts here.</h3>
              <p>You don't have any upcoming reservations at the moment.</p>
              <a className="dashboard-button" href="/rooms">Explore our rooms</a>
            </div>
          )}

          <div className="dashboard-booking-list">
            {upcoming.map((booking) => {
              const room = data?.rooms.find((item) => item.id === booking.roomId);
              return (
                <article className="dashboard-booking" key={booking.id}>
                  <div className="dashboard-booking__main">
                    <div className="dashboard-booking__topline">
                      <span className="dashboard-eyebrow">{booking.id}</span>
                      <span className={`dashboard-status dashboard-status--${booking.status}`}>
                        {booking.status.replace("-", " ")}
                      </span>
                    </div>
                    <h3>{room?.name ?? "MAISON accommodation"}</h3>
                    <p className="dashboard-muted">{room?.type ?? "Room"} · {booking.guestCount ?? 1} guests</p>
                    <div className="dashboard-booking__dates">
                      <span><CalendarDays size={15} /> {date(booking.checkIn)} – {date(booking.checkOut)}</span>
                      <span><MapPin size={15} /> MAISON Hotels & Residences</span>
                    </div>
                  </div>
                  <div className="dashboard-booking__side">
                    <span className="dashboard-muted">Reservation total</span>
                    <strong>{money(booking.totalPrice)}</strong>
                    <button
                      className="dashboard-button dashboard-button--secondary"
                      onClick={() => downloadInvoice(booking, room)}
                    >
                      <Download size={15} /> Invoice
                    </button>
                    {booking.status === "confirmed" && (
                      <button
                        className="dashboard-text-button dashboard-danger"
                        disabled={cancelMutation.isPending}
                        onClick={() => {
                          if (window.confirm("Cancel this reservation?")) {
                            cancelMutation.mutate(booking);
                          }
                        }}
                      >
                        <XCircle size={15} /> Cancel reservation
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="dashboard-section-heading dashboard-section-heading--past">
            <div>
              <span className="dashboard-eyebrow">YOUR HISTORY</span>
              <h2>Past stays</h2>
            </div>
            <span className="dashboard-count">{past.length} reservations</span>
          </div>

          {past.length === 0 && !isLoading && (
            <p className="dashboard-muted dashboard-history-empty">Completed and cancelled stays will appear here.</p>
          )}

          <div className="dashboard-history">
            {past.map((booking) => {
              const room = data?.rooms.find((item) => item.id === booking.roomId);
              const existingReview = data?.reviews.find(
                (review) => review.bookingId === booking.id,
              );
              const draft = reviewDrafts[booking.id] ?? {
                rating: 0,
                comment: "",
              };
              const commentLength = draft.comment.trim().length;

              return (
                <div className="dashboard-history-entry" key={booking.id}>
                  <article className="dashboard-history__item">
                    <div>
                      <strong>{room?.name ?? booking.roomId}</strong>
                      <span>{date(booking.checkIn)} – {date(booking.checkOut)}</span>
                    </div>
                    <span className={`dashboard-status dashboard-status--${booking.status}`}>
                      {booking.status}
                    </span>
                    <strong>{money(booking.totalPrice)}</strong>
                    {booking.status === "completed" && (
                      <button
                        className="dashboard-icon-button"
                        aria-label={`Download invoice for ${booking.id}`}
                        onClick={() => downloadInvoice(booking, room)}
                      >
                        <Download size={17} />
                      </button>
                    )}
                  </article>

                  {booking.status === "completed" && (
                    <section className="dashboard-review-form">
                      {existingReview ? (
                        <div className="dashboard-review-submitted">
                          <CheckCircle2 size={19} />
                          <div>
                            <strong>Thank you for sharing your experience.</strong>
                            <span>Your review has been submitted.</span>
                            <div
                              className="dashboard-review-stars dashboard-review-stars--static"
                              aria-label={`${existingReview.rating} out of 5 stars`}
                            >
                              {Array.from({ length: 5 }, (_, index) => (
                                <Star
                                  key={index}
                                  size={15}
                                  fill={index < existingReview.rating ? "currentColor" : "none"}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="dashboard-review-heading">
                            <div>
                              <span className="dashboard-eyebrow">SHARE YOUR EXPERIENCE</span>
                              <h3>How was your stay?</h3>
                            </div>
                          </div>

                          <div
                            className="dashboard-review-stars"
                            role="group"
                            aria-label="Choose a rating from 1 to 5 stars"
                          >
                            {Array.from({ length: 5 }, (_, index) => {
                              const rating = index + 1;
                              return (
                                <button
                                  key={rating}
                                  type="button"
                                  className={`dashboard-review-star${rating <= draft.rating ? " is-active" : ""}`}
                                  aria-label={`${rating} ${rating === 1 ? "star" : "stars"}`}
                                  aria-pressed={draft.rating === rating}
                                  onClick={() =>
                                    updateReviewDraft(booking.id, { rating })
                                  }
                                >
                                  <Star
                                    size={23}
                                    fill={rating <= draft.rating ? "currentColor" : "none"}
                                  />
                                </button>
                              );
                            })}
                          </div>

                          <textarea
                            className="dashboard-review-textarea"
                            value={draft.comment}
                            maxLength={500}
                            rows={3}
                            placeholder="Tell us what made your stay memorable..."
                            aria-label="Your review"
                            onChange={(event) =>
                              updateReviewDraft(booking.id, {
                                comment: event.target.value,
                              })
                            }
                          />

                          <div className="dashboard-review-footer">
                            <span>{draft.comment.length}/500 characters</span>
                            <button
                              type="button"
                              className="dashboard-button dashboard-review-submit"
                              disabled={
                                !guest ||
                                draft.rating === 0 ||
                                commentLength < 10 ||
                                reviewMutation.isPending
                              }
                              onClick={() =>
                                reviewMutation.mutate({
                                  booking,
                                  rating: draft.rating,
                                  comment: draft.comment,
                                })
                              }
                            >
                              <Send size={14} />
                              {reviewMutation.isPending ? "Submitting..." : "Submit review"}
                            </button>
                          </div>

                          {reviewMutation.isError && (
                            <p className="dashboard-review-error" role="alert">
                              {reviewMutation.error.message}
                            </p>
                          )}
                          <p className="dashboard-review-hint">
                            Select a star rating and write at least 10 characters.
                            Each completed stay can be reviewed once.
                          </p>
                        </>
                      )}
                    </section>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}