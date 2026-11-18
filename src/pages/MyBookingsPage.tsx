import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Download, MapPin, XCircle } from "lucide-react";
import { jsPDF } from "jspdf";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth-store";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import type { Booking, Guest, Room } from "@/types";
import "./DashboardPages.css";

interface BookingData {
  bookings: Booking[];
  guests: Guest[];
  rooms: Room[];
}

async function loadData(): Promise<BookingData> {
  const [bookings, guests, rooms] = await Promise.all([
    api.get<Booking[]>("/bookings"),
    api.get<Guest[]>("/guests"),
    api.get<Room[]>("/rooms"),
  ]);
  return {
    bookings: bookings.data,
    guests: guests.data,
    rooms: rooms.data,
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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["guest-bookings"],
    queryFn: loadData,
  });

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

  const guest = data?.guests.find(
    (item) =>
      item.email.toLowerCase() === user?.email.toLowerCase() ||
      item.name.toLowerCase() === user?.name.toLowerCase(),
  );

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
            {past.map((booking) => (
              <article className="dashboard-history__item" key={booking.id}>
                <div>
                  <strong>{data?.rooms.find((room) => room.id === booking.roomId)?.name ?? booking.roomId}</strong>
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
                    onClick={() => downloadInvoice(booking, data?.rooms.find((room) => room.id === booking.roomId))}
                  >
                    <Download size={17} />
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
