import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { RoomsPage } from "../RoomsPage";
import type { Booking, Room } from "@/types";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock("@/components/layout/SiteHeader", () => ({
  default: () => null,
}));

vi.mock("@/components/layout/SiteFooter", () => ({
  default: () => null,
}));

function makeRoom(
  id: string,
  name: string,
  type: string,
  pricePerNight: number,
  capacity: number,
  rating = 4.5,
): Room {
  return {
    id,
    name,
    type,
    description: `${name} description`,
    pricePerNight,
    capacity,
    status: "available",
    amenities: ["Wi-Fi"],
    images: [],
    rating,
    reviewCount: 0,
  };
}

const rooms: Room[] = [
  makeRoom("room-101", "Classic Suite", "Classic", 180, 2, 4.8),
  makeRoom("room-102", "Garden Deluxe", "Deluxe", 260, 2, 4.9),
  makeRoom("room-201", "Grand Residence", "Suite", 420, 4, 5),
  makeRoom("room-202", "Presidential Suite", "Presidential", 680, 4, 4.8),
  makeRoom("room-301", "Family Residence", "Family", 350, 5, 4.7),
];

const bookings: Booking[] = [
  {
    id: "booking-001",
    guestId: "guest-1",
    roomId: "room-101",
    checkIn: "2099-06-10",
    checkOut: "2099-06-13",
    status: "confirmed",
    services: [],
    totalPrice: 540,
  },
];

function renderRooms(
  roomData: Room[] = rooms,
  bookingData: Booking[] = [],
  shouldFail = false,
) {
  vi.mocked(useQuery).mockImplementation(
    ((options: { queryKey: readonly unknown[] }) => {
      if (options.queryKey[0] === "rooms") {
        return {
          data: shouldFail ? undefined : roomData,
          isLoading: false,
          isError: shouldFail,
          refetch: vi.fn(),
        } as never;
      }

      return {
        data: bookingData,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as never;
    }) as never,
  );

  return render(
    <MemoryRouter>
      <RoomsPage />
    </MemoryRouter>,
  );
}
describe("RoomsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the available room collection", async () => {
    renderRooms();
    expect(
      await screen.findByRole("heading", {
        name: /find your place/i,
      }),
    ).toBeInTheDocument();

    expect(await screen.findByText("Classic Suite")).toBeInTheDocument();
    expect(screen.getByText("Garden Deluxe")).toBeInTheDocument();
    expect(screen.getByText("Grand Residence")).toBeInTheDocument();

    expect(screen.getByText("5 spaces")).toBeInTheDocument();
  });

  it("filters rooms by category", async () => {
    const user = userEvent.setup();
    renderRooms();

    await screen.findByText("Classic Suite");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Room category" }),
      "Deluxe",
    );

    expect(screen.getByText("Garden Deluxe")).toBeInTheDocument();
    expect(screen.queryByText("Classic Suite")).not.toBeInTheDocument();
    expect(screen.queryByText("Grand Residence")).not.toBeInTheDocument();
  });

  it("filters rooms by guest capacity", async () => {
    const user = userEvent.setup();
    renderRooms();

    await screen.findByText("Classic Suite");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Number of guests" }),
      "5",
    );

    expect(screen.getByText("Family Residence")).toBeInTheDocument();
    expect(screen.queryByText("Classic Suite")).not.toBeInTheDocument();
    expect(screen.queryByText("Garden Deluxe")).not.toBeInTheDocument();
  });

  it("filters rooms by maximum price", async () => {
    renderRooms();

    await screen.findByText("Classic Suite");

    fireEvent.change(
      screen.getByRole("slider", {
        name: "Maximum price per night",
      }),
      { target: { value: "300" } },
    );

    expect(screen.getByText("Classic Suite")).toBeInTheDocument();
    expect(screen.getByText("Garden Deluxe")).toBeInTheDocument();
    expect(screen.queryByText("Grand Residence")).not.toBeInTheDocument();
    expect(screen.queryByText("Presidential Suite")).not.toBeInTheDocument();
  });

  it("sorts rooms by price from low to high", async () => {
    const user = userEvent.setup();
    renderRooms();

    await screen.findByText("Classic Suite");

    await user.selectOptions(
      screen.getByRole("combobox", { name: /sort by/i }),
      "price-low",
    );

    const roomHeadings = Array.from(
      document.querySelectorAll(".room-card h3"),
    ).map((heading) => heading.textContent);

    expect(roomHeadings[0]).toBe("Classic Suite");
    expect(roomHeadings[1]).toBe("Garden Deluxe");
    expect(roomHeadings[2]).toBe("Family Residence");
  });

  it("excludes rooms with overlapping confirmed bookings", async () => {
    const user = userEvent.setup();
    renderRooms(rooms, bookings);

    await screen.findByText("Classic Suite");

    await user.type(
      screen.getByLabelText("Check-in date"),
      "2099-06-11",
    );
    await user.type(
      screen.getByLabelText("Check-out date"),
      "2099-06-12",
    );

    await user.click(
      screen.getByRole("button", { name: /update search/i }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Classic Suite")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Garden Deluxe")).toBeInTheDocument();
  });

  it("displays an error when check-out is not later than check-in", async () => {
    renderRooms();

    await screen.findByText("Classic Suite");

    fireEvent.change(
      screen.getByLabelText("Check-in date"),
      { target: { value: "2099-06-12" } },
    );

    fireEvent.change(
      screen.getByLabelText("Check-out date"),
      { target: { value: "2099-06-10" } },
    );

    fireEvent.submit(
      screen.getByRole("button", { name: /update search/i }).closest("form")!,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check-out must be later than check-in.",
    );
  });

  it("shows an empty state when no rooms match the filters", async () => {
    const user = userEvent.setup();
    renderRooms();

    await screen.findByText("Classic Suite");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Number of guests" }),
      "6",
    );

    expect(
      await screen.findByRole("heading", {
        name: "No spaces found just yet.",
      }),
    ).toBeInTheDocument();
  });

  it("shows a retry state when the rooms API fails", async () => {
    renderRooms([], [], true);
    expect(
      await screen.findByRole("heading", {
        name: "We couldn't load the collection.",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });
});












