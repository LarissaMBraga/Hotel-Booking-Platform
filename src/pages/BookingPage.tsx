import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { AvailabilityCalendar } from "@/components/booking/AvailabilityCalendar";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { api } from "@/services/api";
import { formatCurrency } from "@/lib/utils";
import { getNights, hasDateConflict } from "@/lib/booking-utils";
import type { Booking, HotelService, Room } from "@/types";
import "./BookingPage.css";

const TAX_RATE = 0.1;
const EMPTY_SERVICES: HotelService[] = [];
const EMPTY_BOOKINGS: Booking[] = [];

const bookingSchema = z.object({
  checkIn: z.string().min(1, "Choose your check-in date."),
  checkOut: z.string().min(1, "Choose your check-out date."),
  guests: z.number().int().min(1, "At least one guest is required."),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

interface BookingData {
  room: Room;
  bookings: Booking[];
  services: HotelService[];
}

function getLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  if (!value) return "Not selected";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

async function fetchBookingData(roomId: string): Promise<BookingData> {
  const [roomResponse, bookingsResponse, servicesResponse] =
    await Promise.all([
      api.get<Room>(`/rooms/${roomId}`),
      api.get<Booking[]>("/bookings"),
      api.get<HotelService[]>("/services"),
    ]);

  return {
    room: roomResponse.data,
    bookings: bookingsResponse.data,
    services: servicesResponse.data,
  };
}

export function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomId = searchParams.get("roomId") || "";
  const initialCheckIn = searchParams.get("checkIn") || "";
  const initialCheckOut = searchParams.get("checkOut") || "";
  const initialGuests = Math.max(1, Number(searchParams.get("guests")) || 1);

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [formError, setFormError] = useState("");

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["booking-details", roomId],
    queryFn: () => fetchBookingData(roomId),
    enabled: Boolean(roomId),
    retry: 1,
  });

  const form = useForm<BookingFormValues>({
    defaultValues: {
      checkIn: initialCheckIn,
      checkOut: initialCheckOut,
      guests: initialGuests,
    },
  });

  const checkIn = useWatch({ control: form.control, name: "checkIn" });
  const checkOut = useWatch({ control: form.control, name: "checkOut" });
  const guests = useWatch({ control: form.control, name: "guests" });
  const room = data?.room;
  const services = data?.services ?? EMPTY_SERVICES;
  const bookings = data?.bookings ?? EMPTY_BOOKINGS;

  const nights = getNights(checkIn, checkOut);
  const roomSubtotal = room ? nights * room.pricePerNight : 0;

  const selectedServiceItems = services.filter((service) =>
    selectedServices.includes(service.id),
  );

  const servicesSubtotal = selectedServiceItems.reduce(
    (total, service) => total + service.price,
    0,
  );

  const subtotal = roomSubtotal + servicesSubtotal;
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  const datesAreValid =
    Boolean(checkIn && checkOut) &&
    checkIn >= getLocalDate() &&
    checkOut > checkIn;

  const guestCountIsValid =
    Boolean(room) && guests >= 1 && guests <= (room?.capacity ?? 0);

  const hasConflict =
    Boolean(room && datesAreValid) &&
    hasDateConflict(roomId, checkIn, checkOut, bookings);

  const roomIsBlocked =
    room?.status === "cleaning" || room?.status === "occupied";

  const isAvailable =
    Boolean(room && datesAreValid && guestCountIsValid) &&
    !hasConflict &&
    !roomIsBlocked;

  function toggleService(serviceId: string) {
    setSelectedServices((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  }

  function changeGuests(amount: number) {
    const nextValue = Math.min(
      room?.capacity ?? 1,
      Math.max(1, guests + amount),
    );

    form.setValue("guests", nextValue, { shouldValidate: true });
  }

  function handleContinue(values: BookingFormValues) {
    setFormError("");

    const validation = bookingSchema.safeParse(values);

    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message || "Check your details.");
      return;
    }

    if (values.checkIn < getLocalDate()) {
      setFormError("Check-in cannot be in the past.");
      return;
    }

    if (values.checkOut <= values.checkIn) {
      setFormError("Check-out must be after check-in.");
      return;
    }

    if (!room || values.guests > room.capacity) {
      setFormError("The selected room cannot accommodate this number of guests.");
      return;
    }

    if (roomIsBlocked || hasDateConflict(roomId, values.checkIn, values.checkOut, bookings)) {
      setFormError("This room is no longer available for the selected dates.");
      return;
    }

    const params = new URLSearchParams({
      roomId,
      checkIn: values.checkIn,
      checkOut: values.checkOut,
      guests: String(values.guests),
      services: selectedServices.join(","),
    });

    navigate(`/checkout?${params.toString()}`);
  }

  if (!roomId) {
    return (
      <div className="booking-page">
        <SiteHeader />
        <main className="booking-state">
          <span className="maison-eyebrow">Your reservation</span>
          <h1>Choose your stay first.</h1>
          <p>Select a room from our collection to begin your reservation.</p>
          <Link to="/rooms" className="booking-primary-button">
            Explore rooms <ArrowRight size={17} />
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="booking-page">
        <SiteHeader />
        <main className="booking-state" aria-live="polite">
          <LoaderCircle className="booking-spinner" size={30} />
          <p>Preparing your reservation...</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (isError || !room) {
    return (
      <div className="booking-page">
        <SiteHeader />
        <main className="booking-state">
          <span className="maison-eyebrow">Something went wrong</span>
          <h1>We couldn't load this stay.</h1>
          <p>Please try again. Your selected dates have not been lost.</p>
          <button
            className="booking-primary-button"
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? "Trying again..." : "Try again"}
          </button>
          <Link to="/rooms" className="booking-text-link">Back to rooms</Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="booking-page">
      <SiteHeader />

      <main className="booking-main">
        <div className="booking-breadcrumb">
          <Link to={`/rooms/${room.id}`}>
            <ArrowLeft size={15} /> Back to room details
          </Link>
          <span>Reservation / Your stay</span>
        </div>

        <section className="booking-heading">
          <span className="maison-eyebrow">Your reservation</span>
          <h1>Make yourself at home.</h1>
          <p>A few thoughtful details before your Maison experience begins.</p>
        </section>

        <div className="booking-progress" aria-label="Booking progress">
          <div className="booking-progress__step booking-progress__step--active">
            <span>01</span>
            <div><strong>Your stay</strong><small>Review details</small></div>
          </div>
          <div className="booking-progress__line" />
          <div className="booking-progress__step">
            <span>02</span>
            <div><strong>Checkout</strong><small>Payment details</small></div>
          </div>
          <div className="booking-progress__line" />
          <div className="booking-progress__step">
            <span>03</span>
            <div><strong>Confirmation</strong><small>You're all set</small></div>
          </div>
        </div>

        <div className="booking-layout">
          <section className="booking-form-column">
            <form
              className="booking-panel"
              onSubmit={form.handleSubmit(handleContinue)}
              noValidate
            >
              <div className="booking-panel__heading">
                <div>
                  <span className="maison-eyebrow">01 / Stay details</span>
                  <h2>Your time at Maison</h2>
                </div>
                <CalendarDays size={22} />
              </div>

              <AvailabilityCalendar
                roomId={roomId}
                bookings={bookings}
                checkIn={checkIn}
                checkOut={checkOut}
                onDatesChange={(nextCheckIn, nextCheckOut) => {
                  form.setValue("checkIn", nextCheckIn, { shouldValidate: true });
                  form.setValue("checkOut", nextCheckOut, { shouldValidate: true });
                }}
              />
              <div className="booking-date-grid">
                <div className="booking-field">
                  <label htmlFor="booking-check-in">Check-in</label>
                  <input
                    id="booking-check-in"
                    type="date"
                    min={getLocalDate()}
                    {...form.register("checkIn")}
                  />
                  {form.formState.errors.checkIn && (
                    <span className="booking-field__error">
                      {form.formState.errors.checkIn.message}
                    </span>
                  )}
                </div>
                <div className="booking-field">
                  <label htmlFor="booking-check-out">Check-out</label>
                  <input
                    id="booking-check-out"
                    type="date"
                    min={checkIn || getLocalDate()}
                    {...form.register("checkOut")}
                  />
                  {form.formState.errors.checkOut && (
                    <span className="booking-field__error">
                      {form.formState.errors.checkOut.message}
                    </span>
                  )}
                </div>
              </div>

              <div className="booking-guest-control">
                <div>
                  <strong>Guests</strong>
                  <span>Maximum {room.capacity} guests in this room</span>
                </div>
                <div className="booking-counter">
                  <button
                    type="button"
                    aria-label="Remove one guest"
                    onClick={() => changeGuests(-1)}
                    disabled={guests <= 1}
                  >
                    <Minus size={15} />
                  </button>
                  <span>{guests}</span>
                  <button
                    type="button"
                    aria-label="Add one guest"
                    onClick={() => changeGuests(1)}
                    disabled={guests >= room.capacity}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              <div className="booking-divider" />

              <div className="booking-panel__heading booking-services-heading">
                <div>
                  <span className="maison-eyebrow">02 / The little extras</span>
                  <h2>Make it yours</h2>
                  <p>Choose the experiences you'd like to add to your stay.</p>
                </div>
                <Sparkles size={22} />
              </div>

              {services.length === 0 ? (
                <div className="booking-inline-empty">
                  No additional services are available at the moment.
                </div>
              ) : (
                <div className="booking-services">
                  {services.map((service) => {
                    const selected = selectedServices.includes(service.id);

                    return (
                      <label
                        className={`booking-service${selected ? " booking-service--selected" : ""}`}
                        key={service.id}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleService(service.id)}
                        />
                        <span className="booking-service__check">
                          {selected && <Check size={13} />}
                        </span>
                        <span className="booking-service__content">
                          <strong>{service.name}</strong>
                          <small>{service.description}</small>
                        </span>
                        <span className="booking-service__price">
                          {formatCurrency(service.price)}
                          <small>per stay</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {formError && (
                <p className="booking-form-error" role="alert">{formError}</p>
              )}

              {datesAreValid && hasConflict && (
                <p className="booking-form-error" role="alert">
                  These dates overlap with an existing reservation. Please choose another period.
                </p>
              )}

              {roomIsBlocked && (
                <p className="booking-form-error" role="alert">
                  This room is currently unavailable.
                </p>
              )}

              <button
                className="booking-primary-button booking-continue-button"
                type="submit"
                disabled={!isAvailable}
              >
                Continue to checkout <ArrowRight size={17} />
              </button>

              <p className="booking-secure-note">
                <ShieldCheck size={15} />
                Your reservation is not confirmed until payment is completed.
              </p>
            </form>
          </section>

          <aside className="booking-summary">
            <div className="booking-summary__image">
              <img
                src={room.images?.[0] || "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1000&q=85"}
                alt={room.name}
              />
              <span>MAISON COLLECTION</span>
            </div>

            <div className="booking-summary__body">
              <span className="maison-eyebrow">{room.type}</span>
              <h2>{room.name}</h2>
              <div className="booking-summary__meta">
                <span><Users size={15} /> Up to {room.capacity} guests</span>
                <span><Clock3 size={15} /> Flexible stay</span>
              </div>

              <div className="booking-summary__dates">
                <div><small>CHECK-IN</small><strong>{formatDate(checkIn)}</strong></div>
                <div><small>CHECK-OUT</small><strong>{formatDate(checkOut)}</strong></div>
              </div>

              <div className="booking-summary__line">
                <span>{formatCurrency(room.pricePerNight)} × {nights} {nights === 1 ? "night" : "nights"}</span>
                <strong>{formatCurrency(roomSubtotal)}</strong>
              </div>

              {selectedServiceItems.map((service) => (
                <div className="booking-summary__line" key={service.id}>
                  <span>{service.name}</span>
                  <strong>{formatCurrency(service.price)}</strong>
                </div>
              ))}

              <div className="booking-summary__line">
                <span>Estimated tax (10%)</span>
                <strong>{formatCurrency(tax)}</strong>
              </div>

              <div className="booking-summary__total">
                <span>Estimated total</span>
                <strong>{formatCurrency(total)}</strong>
              </div>

              <p className="booking-summary__footnote">
                Final availability is checked again before your payment is processed.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

