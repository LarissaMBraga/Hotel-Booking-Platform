import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/services/api";
import { formatCurrency } from "@/lib/utils";
import { getNights, hasDateConflict, isCardExpired, passesLuhn } from "@/lib/booking-utils";
import type { Booking, Guest, HotelService, Room, RoomStatus } from "@/types";
import "./CheckoutPage.css";

const TAX_RATE = 0.1;

interface CheckoutData {
  room: Room;
  bookings: Booking[];
  services: HotelService[];
  guests: Guest[];
}

interface PaymentFormValues {
  cardholder: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
}

const paymentSchema = z.object({
  cardholder: z.string().trim().min(2, "Enter the cardholder's name."),
  cardNumber: z.string().min(1, "Enter your card number."),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use MM/YY format."),
  cvc: z.string().regex(/^\d{3,4}$/, "Enter a valid security code."),
});

function getLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

async function fetchCheckoutData(roomId: string): Promise<CheckoutData> {
  const [roomResponse, bookingsResponse, servicesResponse, guestsResponse] =
    await Promise.all([
      api.get<Room>(`/rooms/${roomId}`),
      api.get<Booking[]>("/bookings"),
      api.get<HotelService[]>("/services"),
      api.get<Guest[]>("/guests"),
    ]);

  return {
    room: roomResponse.data,
    bookings: bookingsResponse.data,
    services: servicesResponse.data,
    guests: guestsResponse.data,
  };
}

function getNextRoomStatus(
  currentStatus: RoomStatus,
): RoomStatus {
  return currentStatus === "cleaning" || currentStatus === "occupied"
    ? currentStatus
    : "booked";
}

export function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const roomId = searchParams.get("roomId") || "";
  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";
  const guests = Math.max(1, Number(searchParams.get("guests")) || 1);
  const selectedServiceIds = (searchParams.get("services") || "")
    .split(",")
    .filter(Boolean);

  const [paymentError, setPaymentError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["checkout-details", roomId],
    queryFn: () => fetchCheckoutData(roomId),
    enabled: Boolean(roomId),
    retry: 1,
  });

  const form = useForm<PaymentFormValues>({
    defaultValues: {
      cardholder: user?.name || "",
      cardNumber: "",
      expiry: "",
      cvc: "",
    },
  });

  const room = data?.room;
  const bookings = data?.bookings ?? [];
  const services = data?.services ?? [];

  const selectedServices = services.filter((service) =>
    selectedServiceIds.includes(service.id),
  );

  const nights = getNights(checkIn, checkOut);
  const roomSubtotal = room ? nights * room.pricePerNight : 0;
  const servicesSubtotal = selectedServices.reduce(
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

  const hasConflict =
    Boolean(room && datesAreValid) &&
    hasDateConflict(roomId, checkIn, checkOut, bookings);

  const isRoomBlocked =
    room?.status === "cleaning" || room?.status === "occupied";

  async function handlePayment(values: PaymentFormValues) {
    setPaymentError("");

    const validation = paymentSchema.safeParse(values);

    if (!validation.success) {
      setPaymentError(validation.error.issues[0]?.message || "Check your payment details.");
      return;
    }

    const cardNumber = values.cardNumber.replace(/\D/g, "");

    if (!passesLuhn(cardNumber)) {
      setPaymentError("The card number is not valid. Please check and try again.");
      return;
    }

    if (isCardExpired(values.expiry)) {
      setPaymentError("This card has expired. Please use another card.");
      return;
    }

    if (!room || !user || !data) {
      setPaymentError("Your reservation details could not be verified.");
      return;
    }

    if (!datesAreValid || nights < 1) {
      setPaymentError("Your selected dates are invalid. Please return to your stay details.");
      return;
    }

    if (guests > room.capacity || hasConflict || isRoomBlocked) {
      setPaymentError("This room is no longer available for the selected dates. Please choose another stay.");
      return;
    }

    if (selectedServiceIds.some((id) => !services.some((service) => service.id === id))) {
      setPaymentError("One of your selected services is no longer available. Please review your stay.");
      return;
    }

    if (cardNumber.endsWith("0002")) {
      setPaymentError("Your payment was declined by the simulated payment provider. Try another test card.");
      return;
    }

    setProcessing(true);

    let createdGuestId: string | null = null;

    try {
      const latestBookings = await api.get<Booking[]>("/bookings");

      if (
        hasDateConflict(room.id, checkIn, checkOut, latestBookings.data)
      ) {
        setPaymentError("These dates have just been reserved by someone else. Please select another period.");
        return;
      }

      let guest = data.guests.find(
        (item) => item.email.toLowerCase() === user.email.toLowerCase(),
      );

      if (!guest) {

        const guestResponse = await api.post<Guest>("/guests", {
          name: user.name,
          email: user.email,
          phone: "",
        });

        guest = guestResponse.data;
        createdGuestId = guestResponse.data.id;
      }

      const booking: Omit<Booking, "id"> = {
        guestId: guest.id,
        roomId: room.id,
        checkIn,
        checkOut,
        status: "confirmed",
        services: selectedServiceIds,
        totalPrice: Number(total.toFixed(2)),
        guestCount: guests,
        paymentStatus: "paid",
        paymentMethod: "card",
      };

      const previousRoomStatus = room.status;
      const nextStatus = getNextRoomStatus(room.status);

      try {
        if (nextStatus !== previousRoomStatus) {
          await api.patch(`/rooms/${room.id}`, { status: nextStatus });
        }

        const bookingResponse = await api.post<Booking>("/bookings", booking);
        setConfirmedBooking(bookingResponse.data);
      } catch (error) {
        if (nextStatus !== previousRoomStatus) {
          await api.patch(`/rooms/${room.id}`, {
            status: previousRoomStatus,
          }).catch(() => undefined);
        }

        if (createdGuestId) {
          await api.delete(`/guests/${createdGuestId}`).catch(() => undefined);
        }

        throw error;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["checkout-details"] }),
        queryClient.invalidateQueries({ queryKey: ["booking-details"] }),
        queryClient.invalidateQueries({ queryKey: ["rooms"] }),
        queryClient.invalidateQueries({ queryKey: ["my-bookings"] }),
      ]);
    } catch {
      setPaymentError("We couldn't complete your reservation. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  if (!roomId || !checkIn || !checkOut) {
    return (
      <div className="checkout-page">
        <SiteHeader />
        <main className="checkout-state">
          <span className="maison-eyebrow">Your reservation</span>
          <h1>Your stay details are missing.</h1>
          <p>Please return to the room collection and start your reservation again.</p>
          <Link to="/rooms" className="checkout-primary-button">Explore rooms <ArrowRight size={16} /></Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="checkout-page">
        <SiteHeader />
        <main className="checkout-state" aria-live="polite">
          <LoaderCircle className="checkout-spinner" size={30} />
          <p>Securely preparing your checkout...</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (isError || !room) {
    return (
      <div className="checkout-page">
        <SiteHeader />
        <main className="checkout-state">
          <h1>We couldn't load your reservation.</h1>
          <p>Please try again before submitting your payment.</p>
          <button
            className="checkout-primary-button"
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            Try again
          </button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (confirmedBooking) {
    return (
      <div className="checkout-page">
        <SiteHeader />
        <main className="checkout-success">
          <div className="checkout-success__icon"><CheckCircle2 size={35} /></div>
          <span className="maison-eyebrow">Reservation confirmed</span>
          <h1>It's a date with Maison.</h1>
          <p>Your payment was successful and your stay is confirmed. We look forward to welcoming you.</p>
          <div className="checkout-success__reference">
            <span>BOOKING REFERENCE</span>
            <strong>{confirmedBooking.id}</strong>
          </div>
          <div className="checkout-success__details">
            <div><span>Accommodation</span><strong>{room.name}</strong></div>
            <div><span>Arrival</span><strong>{formatDate(checkIn)}</strong></div>
            <div><span>Departure</span><strong>{formatDate(checkOut)}</strong></div>
            <div><span>Total paid</span><strong>{formatCurrency(confirmedBooking.totalPrice)}</strong></div>
          </div>
          <Link to="/my-bookings" className="checkout-primary-button">
            View my bookings <ArrowRight size={16} />
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <SiteHeader />

      <main className="checkout-main">
        <Link to={`/booking?${searchParams.toString()}`} className="checkout-back">
          <ArrowLeft size={15} /> Back to your stay
        </Link>

        <section className="checkout-heading">
          <span className="maison-eyebrow">Almost there</span>
          <h1>A seamless finish.</h1>
          <p>Review your reservation and complete your payment securely.</p>
        </section>

        <div className="checkout-progress">
          <span className="checkout-progress__done"><CheckCircle2 size={15} /> Your stay</span>
          <span className="checkout-progress__active">02&nbsp; Checkout</span>
          <span>03&nbsp; Confirmation</span>
        </div>

        <div className="checkout-layout">
          <section className="checkout-payment-panel">
            <div className="checkout-panel-heading">
              <div>
                <span className="maison-eyebrow">Payment details</span>
                <h2>Card information</h2>
              </div>
              <CreditCard size={23} />
            </div>

            <div className="checkout-demo-note">
              <ShieldCheck size={17} />
              <div>
                <strong>Simulated payment environment</strong>
                <span>Use a valid test card number. No real payment will be made.</span>
              </div>
            </div>

            <form
              className="checkout-form"
              onSubmit={form.handleSubmit(handlePayment)}
              noValidate
            >
              <div className="checkout-field">
                <label htmlFor="checkout-cardholder">Cardholder name</label>
                <input
                  id="checkout-cardholder"
                  autoComplete="cc-name"
                  placeholder="Name on card"
                  {...form.register("cardholder")}
                />
                {form.formState.errors.cardholder && (
                  <small role="alert">{form.formState.errors.cardholder.message}</small>
                )}
              </div>

              <div className="checkout-field">
                <label htmlFor="checkout-card-number">Card number</label>
                <input
                  id="checkout-card-number"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="4242 4242 4242 4242"
                  maxLength={23}
                  {...form.register("cardNumber", {
                    onChange: (event) => {
                      const digits = event.target.value.replace(/\D/g, "").slice(0, 19);
                      event.target.value = digits.replace(/(.{4})/g, "$1 ").trim();
                    },
                  })}
                />
              </div>

              <div className="checkout-field-grid">
                <div className="checkout-field">
                  <label htmlFor="checkout-expiry">Expiry date</label>
                  <input
                    id="checkout-expiry"
                    placeholder="MM/YY"
                    autoComplete="cc-exp"
                    maxLength={5}
                    {...form.register("expiry", {
                      onChange: (event) => {
                        const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
                        event.target.value = digits.length > 2
                          ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                          : digits;
                      },
                    })}
                  />
                </div>
                <div className="checkout-field">
                  <label htmlFor="checkout-cvc">Security code</label>
                  <input
                    id="checkout-cvc"
                    type="password"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="CVC"
                    maxLength={4}
                    {...form.register("cvc")}
                  />
                </div>
              </div>

              {paymentError && (
                <p className="checkout-error" role="alert">{paymentError}</p>
              )}

              {!datesAreValid && (
                <p className="checkout-error" role="alert">
                  Your selected dates are invalid. Return to your stay details.
                </p>
              )}

              {hasConflict && (
                <p className="checkout-error" role="alert">
                  This room is no longer available for the selected dates.
                </p>
              )}

              {isRoomBlocked && (
                <p className="checkout-error" role="alert">
                  This room is currently unavailable.
                </p>
              )}

              <button
                className="checkout-primary-button checkout-pay-button"
                type="submit"
                disabled={
                  processing ||
                  !datesAreValid ||
                  hasConflict ||
                  isRoomBlocked
                }
              >
                {processing ? (
                  <><LoaderCircle className="checkout-spinner" size={17} /> Processing payment...</>
                ) : (
                  <><LockKeyhole size={16} /> Pay {formatCurrency(total)}</>
                )}
              </button>

              <p className="checkout-security-note">
                <LockKeyhole size={13} />
                Your payment information is used only for this simulated checkout.
              </p>
            </form>
          </section>

          <aside className="checkout-order">
            <span className="maison-eyebrow">Your reservation</span>
            <h2>{room.name}</h2>
            <p className="checkout-order__type">{room.type} · {guests} {guests === 1 ? "guest" : "guests"}</p>

            <div className="checkout-order__dates">
              <div><small>CHECK-IN</small><strong>{formatDate(checkIn)}</strong></div>
              <div><small>CHECK-OUT</small><strong>{formatDate(checkOut)}</strong></div>
            </div>

            <div className="checkout-order__line">
              <span>{formatCurrency(room.pricePerNight)} × {nights} {nights === 1 ? "night" : "nights"}</span>
              <strong>{formatCurrency(roomSubtotal)}</strong>
            </div>

            {selectedServices.map((service) => (
              <div className="checkout-order__line" key={service.id}>
                <span>{service.name}</span>
                <strong>{formatCurrency(service.price)}</strong>
              </div>
            ))}

            <div className="checkout-order__line">
              <span>Estimated tax (10%)</span>
              <strong>{formatCurrency(tax)}</strong>
            </div>

            <div className="checkout-order__total">
              <span>Total</span>
              <strong>{formatCurrency(total)}</strong>
            </div>

            <p className="checkout-order__note">
              By completing payment, you confirm that your reservation details are correct.
            </p>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}




