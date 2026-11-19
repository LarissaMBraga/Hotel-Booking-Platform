import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { hasDateConflict } from "@/lib/booking-utils";
import type { Booking } from "@/types";
import "./AvailabilityCalendar.css";

interface AvailabilityCalendarProps {
  roomId: string;
  bookings: Booking[];
  checkIn: string;
  checkOut: string;
  onDatesChange: (checkIn: string, checkOut: string) => void;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getToday() {
  return toDateKey(new Date());
}

export function AvailabilityCalendar({
  roomId,
  bookings,
  checkIn,
  checkOut,
  onDatesChange,
}: AvailabilityCalendarProps) {
  const initialDate = checkIn ? new Date(`${checkIn}T00:00:00`) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstWeekday + 6) % 7;
  const today = getToday();
  const selectingCheckout = Boolean(checkIn && !checkOut);

  const days = Array.from({ length: offset + daysInMonth }, (_, index) => {
    if (index < offset) return null;
    return toDateKey(new Date(year, month, index - offset + 1));
  });

  function isBookedNight(date: string) {
    return bookings.some(
      (booking) =>
        booking.roomId === roomId &&
        (booking.status === "confirmed" || booking.status === "checked-in") &&
        booking.checkIn <= date &&
        booking.checkOut > date,
    );
  }

  function isDisabled(date: string) {
    if (date < today) return true;

    if (!selectingCheckout) {
      return isBookedNight(date);
    }

    return (
      date <= checkIn ||
      hasDateConflict(roomId, checkIn, date, bookings)
    );
  }

  function selectDate(date: string) {
    if (isDisabled(date)) return;

    if (!selectingCheckout) {
      onDatesChange(date, "");
      return;
    }

    onDatesChange(checkIn, date);
  }

  function changeMonth(amount: number) {
    setVisibleMonth(new Date(year, month + amount, 1));
  }

  return (
    <section className="availability-calendar" aria-label="Room availability calendar">
      <div className="availability-calendar__header">
        <div>
          <span className="availability-calendar__eyebrow">AVAILABILITY</span>
          <h3>
            {visibleMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h3>
        </div>
        <div className="availability-calendar__navigation">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="availability-calendar__grid availability-calendar__weekdays">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="availability-calendar__grid">
        {days.map((date, index) => {
          if (!date) {
            return <span className="availability-calendar__empty" key={`empty-${index}`} />;
          }

          const booked = isBookedNight(date);
          const disabled = isDisabled(date);
          const selected = date === checkIn || date === checkOut;
          const inRange = Boolean(checkIn && checkOut && date > checkIn && date < checkOut);

          return (
            <button
              type="button"
              key={date}
              disabled={disabled}
              onClick={() => selectDate(date)}
              className={[
                "availability-calendar__day",
                booked ? "availability-calendar__day--booked" : "",
                selected ? "availability-calendar__day--selected" : "",
                inRange ? "availability-calendar__day--range" : "",
                date === today ? "availability-calendar__day--today" : "",
              ].filter(Boolean).join(" ")}
              aria-label={`${date}${booked ? ", reserved" : ""}${selected ? ", selected" : ""}`}
              aria-pressed={selected}
              title={booked ? "Already reserved" : undefined}
            >
              {Number(date.slice(-2))}
            </button>
          );
        })}
      </div>

      <div className="availability-calendar__legend">
        <span><i className="availability-calendar__legend-dot availability-calendar__legend-dot--available" /> Available</span>
        <span><i className="availability-calendar__legend-dot availability-calendar__legend-dot--booked" /> Reserved</span>
        <span><i className="availability-calendar__legend-dot availability-calendar__legend-dot--selected" /> Selected</span>
      </div>

      <p className="availability-calendar__hint">
        {selectingCheckout
          ? "Choose your check-out date."
          : "Choose an available check-in date to begin."}
      </p>
    </section>
  );
}
