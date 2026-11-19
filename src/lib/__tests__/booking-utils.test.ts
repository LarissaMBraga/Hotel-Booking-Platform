import { describe, expect, it } from "vitest";
import {
  getNights,
  hasDateConflict,
  isCardExpired,
  passesLuhn,
} from "../booking-utils";
import type { Booking } from "@/types";

const bookings: Booking[] = [
  {
    id: "booking-1",
    guestId: "guest-1",
    roomId: "room-101",
    checkIn: "2026-12-10",
    checkOut: "2026-12-13",
    status: "confirmed",
    services: [],
    totalPrice: 594,
  },
  {
    id: "booking-2",
    guestId: "guest-2",
    roomId: "room-102",
    checkIn: "2026-12-10",
    checkOut: "2026-12-13",
    status: "cancelled",
    services: [],
    totalPrice: 594,
  },
  {
    id: "booking-3",
    guestId: "guest-3",
    roomId: "room-103",
    checkIn: "2026-12-10",
    checkOut: "2026-12-13",
    status: "completed",
    services: [],
    totalPrice: 594,
  },
  {
    id: "booking-4",
    guestId: "guest-4",
    roomId: "room-104",
    checkIn: "2026-12-10",
    checkOut: "2026-12-13",
    status: "checked-in",
    services: [],
    totalPrice: 594,
  },
];

describe("getNights", () => {
  it("calculates the number of nights between two dates", () => {
    expect(getNights("2026-12-10", "2026-12-13")).toBe(3);
  });

  it("returns zero when the dates are the same", () => {
    expect(getNights("2026-12-10", "2026-12-10")).toBe(0);
  });

  it("returns zero when checkout is before check-in", () => {
    expect(getNights("2026-12-13", "2026-12-10")).toBe(0);
  });

  it("returns zero when a date is missing", () => {
    expect(getNights("", "2026-12-13")).toBe(0);
  });
});

describe("hasDateConflict", () => {
  it("detects an overlapping confirmed reservation", () => {
    expect(
      hasDateConflict("room-101", "2026-12-12", "2026-12-15", bookings),
    ).toBe(true);
  });

  it("detects an overlapping checked-in reservation", () => {
    expect(
      hasDateConflict("room-104", "2026-12-12", "2026-12-15", bookings),
    ).toBe(true);
  });

  it("allows a reservation immediately after an existing stay", () => {
    expect(
      hasDateConflict("room-101", "2026-12-13", "2026-12-16", bookings),
    ).toBe(false);
  });

  it("does not consider reservations from another room", () => {
    expect(
      hasDateConflict("room-999", "2026-12-11", "2026-12-12", bookings),
    ).toBe(false);
  });

  it("ignores cancelled reservations", () => {
    expect(
      hasDateConflict("room-102", "2026-12-11", "2026-12-12", bookings),
    ).toBe(false);
  });

  it("ignores completed reservations", () => {
    expect(
      hasDateConflict("room-103", "2026-12-11", "2026-12-12", bookings),
    ).toBe(false);
  });

  it("rejects invalid date ranges", () => {
    expect(
      hasDateConflict("room-101", "2026-12-13", "2026-12-10", bookings),
    ).toBe(false);
  });

  it("returns false when a required value is missing", () => {
    expect(hasDateConflict("", "2026-12-11", "2026-12-12", bookings)).toBe(
      false,
    );
  });
});

describe("passesLuhn", () => {
  it("accepts a valid test card number", () => {
    expect(passesLuhn("4242 4242 4242 4242")).toBe(true);
  });

  it("rejects a number with an invalid checksum", () => {
    expect(passesLuhn("4242 4242 4242 4241")).toBe(false);
  });

  it("rejects numbers that are too short", () => {
    expect(passesLuhn("424242")).toBe(false);
  });
});

describe("isCardExpired", () => {
  it("accepts a card expiring after the current month", () => {
    expect(isCardExpired("12/30", new Date("2026-11-17T12:00:00"))).toBe(
      false,
    );
  });

  it("rejects a card whose expiration month has passed", () => {
    expect(isCardExpired("10/26", new Date("2026-11-17T12:00:00"))).toBe(true);
  });

  it("rejects an invalid expiration month", () => {
    expect(isCardExpired("13/30", new Date("2026-11-17T12:00:00"))).toBe(true);
  });
});
