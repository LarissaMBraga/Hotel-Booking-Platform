import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock3, LogIn, LogOut, RefreshCw } from "lucide-react";
import { api } from "@/services/api";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import type { Booking, Guest, Room } from "@/types";
import "./DashboardPages.css";

interface ReceptionData {
  bookings: Booking[];
  guests: Guest[];
  rooms: Room[];
}

async function loadReception(): Promise<ReceptionData> {
  const [bookings, guests, rooms] = await Promise.all([
    api.get<Booking[]>("/bookings"),
    api.get<Guest[]>("/guests"),
    api.get<Room[]>("/rooms"),
  ]);
  return { bookings: bookings.data, guests: guests.data, rooms: rooms.data };
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function displayDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ReceptionPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["reception-data"],
    queryFn: loadReception,
  });

  const operation = useMutation({
    mutationFn: async ({
      booking,
      action,
    }: {
      booking: Booking;
      action: "check-in" | "check-out" | "cancel";
    }) => {
      const room = data?.rooms.find((item) => item.id === booking.roomId);
      if (action === "check-in") {
        await api.patch(`/bookings/${booking.id}`, { status: "checked-in" });
        if (room) await api.patch(`/rooms/${room.id}`, { status: "occupied" });
      }
      if (action === "check-out") {
        await api.patch(`/bookings/${booking.id}`, { status: "completed", paymentStatus: "paid" });
        if (room) await api.patch(`/rooms/${room.id}`, { status: "cleaning" });
      }
      if (action === "cancel") {
        await api.patch(`/bookings/${booking.id}`, { status: "cancelled" });
        if (room && room.status === "booked") {
          await api.patch(`/rooms/${room.id}`, { status: "available" });
        }
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reception-data"] }),
        queryClient.invalidateQueries({ queryKey: ["bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["rooms"] }),
        queryClient.invalidateQueries({ queryKey: ["guest-bookings"] }),
      ]);
    },
  });

  const today = localDate();
  const bookings = useMemo(() => {
    const all = data?.bookings ?? [];
    if (filter === "arrivals") return all.filter((item) => item.checkIn === today && item.status === "confirmed");
    if (filter === "departures") return all.filter((item) => item.checkOut === today && item.status === "checked-in");
    if (filter === "in-house") return all.filter((item) => item.status === "checked-in");
    return all.filter((item) => item.status !== "cancelled" && item.status !== "completed");
  }, [data?.bookings, filter, today]);

  const arrivals = (data?.bookings ?? []).filter((item) => item.checkIn === today && item.status === "confirmed").length;
  const departures = (data?.bookings ?? []).filter((item) => item.checkOut === today && item.status === "checked-in").length;
  const inHouse = (data?.bookings ?? []).filter((item) => item.status === "checked-in").length;
  const availableRooms = (data?.rooms ?? []).filter((room) => room.status === "available").length;

  return (
    <>
      <SiteHeader />
      <main className="dashboard-page">
        <header className="dashboard-hero">
          <span className="dashboard-eyebrow">FRONT DESK</span>
          <h1>Reception<span>.</span></h1>
          <p>Arrivals, departures and room operations, all in one view.</p>
        </header>

        <section className="dashboard-content">
          <div className="dashboard-metrics">
            <article className="dashboard-metric"><span>Today's arrivals</span><strong>{arrivals}</strong><CalendarDays /></article>
            <article className="dashboard-metric"><span>Today's departures</span><strong>{departures}</strong><LogOut /></article>
            <article className="dashboard-metric"><span>Guests in-house</span><strong>{inHouse}</strong><Clock3 /></article>
            <article className="dashboard-metric"><span>Available rooms</span><strong>{availableRooms}</strong><CheckCircle2 /></article>
          </div>

          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-eyebrow">LIVE OPERATIONS</span>
              <h2>Reservation desk</h2>
            </div>
            <button className="dashboard-button dashboard-button--secondary" onClick={() => void refetch()}>
              <RefreshCw size={15} /> Refresh
            </button>
          </div>

          <div className="dashboard-tabs" role="group" aria-label="Filter reservations">
            {[
              ["all", "Active reservations"],
              ["arrivals", "Today's arrivals"],
              ["departures", "Today's departures"],
              ["in-house", "In-house"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? "is-active" : ""}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {isLoading && <div className="dashboard-state">Loading front desk data...</div>}
          {isError && <div className="dashboard-state" role="alert">Unable to load operations. <button onClick={() => void refetch()}>Try again</button></div>}
          {!isLoading && !isError && bookings.length === 0 && (
            <div className="dashboard-empty">
              <CalendarDays size={28} />
              <h3>Nothing to manage here.</h3>
              <p>There are no reservations in this view.</p>
            </div>
          )}

          <div className="dashboard-table-wrap">
            {bookings.map((booking) => {
              const guest = data?.guests.find((item: Guest) => item.id === booking.guestId);
              const room = data?.rooms.find((item: Room) => item.id === booking.roomId);
              return (
                <article className="reception-row" key={booking.id}>
                  <div className="reception-row__guest">
                    <span className="dashboard-eyebrow">{booking.id}</span>
                    <strong>{guest?.name ?? "Guest"}</strong>
                    <span>{guest?.email ?? "No email on file"}</span>
                  </div>
                  <div>
                    <span className="dashboard-muted">Accommodation</span>
                    <strong>{room?.name ?? booking.roomId}</strong>
                    <span className="dashboard-muted">{room?.type ?? "Room"}</span>
                  </div>
                  <div>
                    <span className="dashboard-muted">Stay dates</span>
                    <strong>{displayDate(booking.checkIn)}</strong>
                    <span className="dashboard-muted">to {displayDate(booking.checkOut)}</span>
                  </div>
                  <div className="reception-row__actions">
                    <span className={`dashboard-status dashboard-status--${booking.status}`}>{booking.status}</span>
                    {booking.status === "confirmed" && (
                      <button
                        className="dashboard-button"
                        disabled={operation.isPending}
                        onClick={() => operation.mutate({ booking, action: "check-in" })}
                      >
                        <LogIn size={15} /> Check in
                      </button>
                    )}
                    {booking.status === "checked-in" && (
                      <button
                        className="dashboard-button"
                        disabled={operation.isPending}
                        onClick={() => operation.mutate({ booking, action: "check-out" })}
                      >
                        <LogOut size={15} /> Check out
                      </button>
                    )}
                    {booking.status === "confirmed" && (
                      <button
                        className="dashboard-text-button dashboard-danger"
                        disabled={operation.isPending}
                        onClick={() => {
                          if (window.confirm("Cancel this reservation?")) {
                            operation.mutate({ booking, action: "cancel" });
                          }
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {operation.isError && (
            <p className="dashboard-error" role="alert">
              The operation could not be completed. Refresh the data and try again.
            </p>
          )}
          <p className="dashboard-footnote">Room status changes to occupied at check-in and cleaning after check-out.</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
