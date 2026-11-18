import type { Booking } from "@/types";

export function getNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;

  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  const difference = end.getTime() - start.getTime();

  return difference > 0 ? Math.round(difference / 86400000) : 0;
}

export function hasDateConflict(
  roomId: string,
  checkIn: string,
  checkOut: string,
  bookings: Booking[],
): boolean {
  return bookings.some(
    (booking) =>
      booking.roomId === roomId &&
      booking.status !== "cancelled" &&
      booking.checkIn < checkOut &&
      booking.checkOut > checkIn,
  );
}

export function passesLuhn(value: string): boolean {
  const digits = value.replace(/\D/g, "");

  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let doubleDigit = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);

    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}

export function isCardExpired(expiry: string, now = new Date()): boolean {
  const [month, year] = expiry.split("/").map(Number);

  if (!month || !year || month < 1 || month > 12) return true;

  const expiration = new Date(2000 + year, month, 1);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return expiration <= currentMonth;
}
