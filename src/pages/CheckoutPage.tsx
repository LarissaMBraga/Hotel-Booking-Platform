import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Hotel,
  LoaderCircle,
  QrCode,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/services/api";
import { formatCurrency } from "@/lib/utils";
import { getNights, hasDateConflict } from "@/lib/booking-utils";
import type { Booking, Guest, HotelService, Room, RoomStatus } from "@/types";
import "./CheckoutPage.css";

const TAX_RATE = 0.1;

type PaymentMethod = NonNullable<Booking["paymentMethod"]>;

interface CheckoutData {
  room: Room;
  bookings: Booking[];
  services: HotelService[];
  guests: Guest[];
}

const paymentMethods: {
  id: PaymentMethod;
  title: string;
  description: string;
  icon: typeof CreditCard;
}[] = [
  {
    id: "card",
    title: "Credit / Debit Card",
    description: "Simulated card confirmation",
    icon: CreditCard,
  },
  {
    id: "pix",
    title: "Pix",
    description: "Illustrative QR code",
    icon: QrCode,
  },
  {
    id: "paypal",
    title: "PayPal",
    description: "Simulated authorization",
    icon: WalletCards,
  },
  {
    id: "pay-at-hotel",
    title: "Pay at Hotel",
    description: "Settle your balance at reception",
    icon: Hotel,
  },
];

const qrPattern = [
  "1111111001011",
  "1000001011010",
  "1011101010111",
  "1011101001001",
  "1011101011101",
  "1000001010010",
  "1111111010101",
  "0000000011010",
  "1101011100111",
  "0110100111000",
  "1011011010110",
  "0100110101101",
  "1110011011011",
];

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

function getNextRoomStatus(currentStatus: RoomStatus): RoomStatus {
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

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
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

  async function handleReservation() {
    setPaymentError("");

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

    setProcessing(true);

    let createdGuestId: string | null = null;

    try {
      const latestBookings = await api.get<Booking[]>("/bookings");

      if (hasDateConflict(room.id, checkIn, checkOut, latestBookings.data)) {
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

      const paymentStatus: Booking["paymentStatus"] =
        paymentMethod === "pay-at-hotel" ? "pending" : "simulated";

      const booking: Omit<Booking, "id"> = {
        guestId: guest.id,
        roomId: room.id,
        checkIn,
        checkOut,
        status: "confirmed",
        services: selectedServiceIds,
        totalPrice: Number(total.toFixed(2)),
        guestCount: guests,
        paymentStatus,
        paymentMethod,
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
          <Link to="/rooms" className="checkout-primary-button">
            Explore rooms <ArrowRight size={16} />
          </Link>
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
          <p>Preparing your reservation...</p>
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
          <p>Please try again before confirming your stay.</p>
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
    const isPayAtHotel = confirmedBooking.paymentMethod === "pay-at-hotel";

    return (
      <div className="checkout-page">
        <SiteHeader />
        <main className="checkout-success">
          <div className="checkout-success__icon">
            <CheckCircle2 size={35} />
          </div>
          <span className="maison-eyebrow">Reservation confirmed</span>
          <h1>It's a date with Maison.</h1>
          <p>
            {isPayAtHotel
              ? "Your stay is confirmed. You can settle your balance when you arrive at the hotel."
              : "Your reservation is confirmed in our demo environment. No payment was processed or charged."}
          </p>
          <div className="checkout-success__reference">
            <span>BOOKING REFERENCE</span>
            <strong>{confirmedBooking.id}</strong>
          </div>
          <div className="checkout-success__details">
            <div><span>Accommodation</span><strong>{room.name}</strong></div>
            <div><span>Arrival</span><strong>{formatDate(checkIn)}</strong></div>
            <div><span>Departure</span><strong>{formatDate(checkOut)}</strong></div>
            <div><span>Payment method</span><strong>{paymentMethods.find((method) => method.id === confirmedBooking.paymentMethod)?.title}</strong></div>
            <div><span>Payment status</span><strong>{isPayAtHotel ? "Pending at hotel" : "Demo confirmed"}</strong></div>
            <div><span>Reservation total</span><strong>{formatCurrency(confirmedBooking.totalPrice)}</strong></div>
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
          <p>Choose how you would like to complete your reservation.</p>
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
                <span className="maison-eyebrow">Payment options</span>
                <h2>Choose your method</h2>
              </div>
              <WalletCards size={23} />
            </div>

            <div className="checkout-demo-note">
              <ShieldCheck size={17} />
              <div>
                <strong>Demonstration environment</strong>
                <span>No real payments, external transactions or charges are made on this website.</span>
              </div>
            </div>

            <div className="checkout-methods" role="group" aria-label="Payment method">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = paymentMethod === method.id;

                return (
                  <button
                    className={`checkout-method${isSelected ? " checkout-method--selected" : ""}`}
                    type="button"
                    key={method.id}
                    aria-pressed={isSelected}
                    onClick={() => {
                      setPaymentMethod(method.id);
                      setPaymentError("");
                    }}
                  >
                    <span className="checkout-method__icon"><Icon size={20} /></span>
                    <span className="checkout-method__copy">
                      <strong>{method.title}</strong>
                      <small>{method.description}</small>
                    </span>
                    <span className="checkout-method__radio" />
                  </button>
                );
              })}
            </div>

            <div className="checkout-method-detail" aria-live="polite">
              {paymentMethod === "card" && (
                <div className="checkout-demo-detail">
                  <div className="checkout-detail-heading">
                    <CreditCard size={19} />
                    <h3>Card payment simulation</h3>
                  </div>
                  <div className="checkout-demo-card">
                    <div className="checkout-demo-card__top">
                      <span>MAISON</span>
                      <CreditCard size={25} />
                    </div>
                    <strong>•••• &nbsp; •••• &nbsp; •••• &nbsp; 4242</strong>
                    <div className="checkout-demo-card__bottom">
                      <span>DEMO CARD</span>
                      <span>NO CHARGE</span>
                    </div>
                  </div>
                  <p>This is a visual card preview only. No card details are requested or stored.</p>
                </div>
              )}

              {paymentMethod === "pix" && (
                <div className="checkout-demo-detail checkout-pix-detail">
                  <div className="checkout-detail-heading">
                    <QrCode size={19} />
                    <h3>Pix payment simulation</h3>
                  </div>
                  <div className="checkout-qr" aria-label="Illustrative QR pattern, not a valid Pix code">
                    {qrPattern.join("").split("").map((cell, index) => (
                      <span className={cell === "1" ? "checkout-qr__cell checkout-qr__cell--dark" : "checkout-qr__cell"} key={index} />
                    ))}
                  </div>
                  <strong>Illustrative QR code</strong>
                  <p>This pattern is decorative and cannot be scanned or used to make a Pix transfer.</p>
                </div>
              )}

              {paymentMethod === "paypal" && (
                <div className="checkout-demo-detail">
                  <div className="checkout-detail-heading">
                    <WalletCards size={19} />
                    <h3>PayPal authorization simulation</h3>
                  </div>
                  <div className="checkout-paypal-mark">PayPal</div>
                  <p>Continue to simulate an authorization. No PayPal account or external service is contacted.</p>
                </div>
              )}

              {paymentMethod === "pay-at-hotel" && (
                <div className="checkout-demo-detail">
                  <div className="checkout-detail-heading">
                    <Hotel size={19} />
                    <h3>Settle your balance at the hotel</h3>
                  </div>
                  <p>Your reservation will be confirmed now. Payment will remain pending until it is handled at reception.</p>
                  <span className="checkout-pending-note">Payment due at the hotel</span>
                </div>
              )}
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
              type="button"
              onClick={() => void handleReservation()}
              disabled={
                processing ||
                !datesAreValid ||
                hasConflict ||
                isRoomBlocked
              }
            >
              {processing ? (
                <><LoaderCircle className="checkout-spinner" size={17} /> Confirming reservation...</>
              ) : (
                <><CheckCircle2 size={16} /> {paymentMethod === "pay-at-hotel" ? "Confirm reservation" : `Simulate ${paymentMethods.find((method) => method.id === paymentMethod)?.title} payment`}</>
              )}
            </button>

            <p className="checkout-security-note">
              <ShieldCheck size={13} />
              Demo only. No payment information is collected or processed.
            </p>
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
              <span>Reservation total</span>
              <strong>{formatCurrency(total)}</strong>
            </div>

            <p className="checkout-order__note">
              This is a demonstration reservation. No payment or charge will be made.
            </p>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
