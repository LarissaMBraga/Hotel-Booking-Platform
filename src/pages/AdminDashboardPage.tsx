import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BedDouble,
  CalendarCheck,
  DollarSign,
  ImagePlus,
  Percent,
  Plus,
  Trash2,
  RefreshCw,
  X,
} from "lucide-react";
import { api } from "@/services/api";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import type { Booking, Room } from "@/types";
import "./DashboardPages.css";

interface AdminData {
  bookings: Booking[];
  rooms: Room[];
}

interface RoomDraft {
  name: string;
  type: string;
  description: string;
  pricePerNight: string;
  capacity: string;
  amenities: string;
}

type Period = "7" | "30" | "90" | "all";

async function loadAdmin(): Promise<AdminData> {
  const [bookings, rooms] = await Promise.all([
    api.get<Booking[]>("/bookings"),
    api.get<Room[]>("/rooms"),
  ]);

  return {
    bookings: bookings.data,
    rooms: rooms.data,
  };
}

const currency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const initialRoomDraft: RoomDraft = {
  name: "",
  type: "Deluxe",
  description: "",
  pricePerNight: "",
  capacity: "2",
  amenities: "",
};

const chartColors = ["#a88b5c", "#7f8b78", "#b9a58a", "#59645d", "#c6bda9"];

export function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: loadAdmin,
  });

  const [period, setPeriod] = useState<Period>("30");
  const [roomDraft, setRoomDraft] = useState<RoomDraft>(initialRoomDraft);
  const [imagePreview, setImagePreview] = useState("");
  const [imageError, setImageError] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const rooms = useMemo(() => data?.rooms ?? [], [data?.rooms]);
  const recentRooms = useMemo(() => [...rooms].reverse(), [rooms]);
  const bookings = useMemo(() => data?.bookings ?? [], [data?.bookings]);

  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const filteredBookings = useMemo(() => {
    if (period === "all") return bookings;

    const cutoff = new Date(`${today}T12:00:00`);
    cutoff.setDate(cutoff.getDate() - Number(period));
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    return bookings.filter((booking) => booking.checkIn >= cutoffDate);
  }, [bookings, period, today]);

  const activeBookings = filteredBookings.filter(
    (item) => item.status !== "cancelled",
  );

  const occupiedRooms = rooms.filter(
    (room) => room.status === "occupied",
  ).length;

  const occupancy = rooms.length
    ? Math.round((occupiedRooms / rooms.length) * 100)
    : 0;

  const revenue = filteredBookings
    .filter(
      (item) =>
        item.status === "completed" || item.paymentStatus === "paid",
    )
    .reduce((total, item) => total + item.totalPrice, 0);

  const roomTypes = useMemo(() => {
    const counts = new Map<string, number>();

    rooms.forEach((room) => {
      counts.set(room.type, (counts.get(room.type) ?? 0) + 1);
    });

    return Array.from(counts, ([name, value]) => ({ name, value }));
  }, [rooms]);

  const monthlyRevenue = useMemo(() => {
    const labels = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    return labels.map((month, index) => ({
      month,
      revenue: filteredBookings
        .filter((booking) => {
          const bookingMonth =
            Number(booking.checkIn.slice(5, 7)) - 1;

          return (
            bookingMonth === index &&
            (booking.status === "completed" ||
              booking.paymentStatus === "paid")
          );
        })
        .reduce((sum, booking) => sum + booking.totalPrice, 0),
    }));
  }, [filteredBookings]);

  const bookingStatus = useMemo(
    () => [
      {
        name: "Confirmed",
        value: filteredBookings.filter(
          (item) => item.status === "confirmed",
        ).length,
      },
      {
        name: "Checked in",
        value: filteredBookings.filter(
          (item) => item.status === "checked-in",
        ).length,
      },
      {
        name: "Completed",
        value: filteredBookings.filter(
          (item) => item.status === "completed",
        ).length,
      },
      {
        name: "Cancelled",
        value: filteredBookings.filter(
          (item) => item.status === "cancelled",
        ).length,
      },
    ],
    [filteredBookings],
  );

  const addRoomMutation = useMutation({
    mutationFn: async (room: Omit<Room, "id">) => {
      const response = await api.post<Room>("/rooms", room);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin-dashboard"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["rooms"],
      });
      setRoomDraft(initialRoomDraft);
      setImagePreview("");
      setImageError("");
      setFormError("");
      setFormSuccess("The new room has been added to your inventory.");
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      await api.delete(`/rooms/${roomId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin-dashboard"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["rooms"],
      });
      setDeleteError("");
    },
    onError: () => {
      setDeleteError("Unable to delete this room. Please try again.");
    },
  });

  function handleDeleteRoom(room: Room) {
    const hasBookings = bookings.some(
      (booking) => booking.roomId === room.id,
    );

    if (hasBookings) {
      window.alert(
        `"${room.name}" cannot be deleted because it is linked to an existing reservation.`,
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${room.name}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setDeleteError("");
    deleteRoomMutation.mutate(room.id);
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setImageError("");
    setImagePreview("");

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setImageError("Choose a JPG, PNG or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError("The image must be smaller than 5 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImagePreview(reader.result);
      }
    };

    reader.onerror = () => {
      setImageError("Unable to read this image. Please try another file.");
    };

    reader.readAsDataURL(file);
  }

  async function handleAddRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");

    const price = Number(roomDraft.pricePerNight);
    const capacity = Number(roomDraft.capacity);

    if (!Number.isFinite(price) || price <= 0) {
      setFormError("Enter a valid nightly rate greater than zero.");
      return;
    }

    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) {
      setFormError("Room capacity must be between 1 and 20 guests.");
      return;
    }

    if (!roomDraft.name.trim() || !roomDraft.description.trim()) {
      setFormError("Complete the room name and description.");
      return;
    }

    if (imageError) {
      setFormError("Please resolve the image upload issue before continuing.");
      return;
    }

    const newRoom: Omit<Room, "id"> = {
      name: roomDraft.name.trim(),
      type: roomDraft.type,
      description: roomDraft.description.trim(),
      pricePerNight: price,
      capacity,
      status: "available",
      amenities: roomDraft.amenities
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      images: imagePreview ? [imagePreview] : [],
      rating: 0,
      reviewCount: 0,
    };

    try {
      await addRoomMutation.mutateAsync(newRoom);
    } catch {
      setFormError("Unable to add this room. Please try again.");
    }
  }

  function updateRoomDraft(
    field: keyof RoomDraft,
    value: string,
  ) {
    setRoomDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <>
      <SiteHeader />

      <main className="dashboard-page">
        <header className="dashboard-hero">
          <span className="dashboard-eyebrow">
            MANAGEMENT OVERVIEW
          </span>
          <h1>
            The Maison report<span>.</span>
          </h1>
          <p>
            A clear view of hotel performance, reservations and room
            operations.
          </p>
        </header>

        <section className="dashboard-content">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-eyebrow">
                HOTEL PERFORMANCE
              </span>
              <h2>At a glance</h2>
            </div>

            <div className="dashboard-toolbar">
              <label className="dashboard-period-control">
                <span>Reporting period</span>
                <select
                  value={period}
                  onChange={(event) =>
                    setPeriod(event.target.value as Period)
                  }
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="all">All time</option>
                </select>
              </label>

              <button
                className="dashboard-button dashboard-button--secondary"
                onClick={() => void refetch()}
                type="button"
              >
                <RefreshCw size={15} />
                Refresh data
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="dashboard-state">
              Preparing your hotel report...
            </div>
          )}

          {isError && (
            <div className="dashboard-state" role="alert">
              Unable to load analytics.
              <button onClick={() => void refetch()} type="button">
                Try again
              </button>
            </div>
          )}

          {!isLoading && !isError && (
            <>
              <div className="dashboard-metrics">
                <article className="dashboard-metric">
                  <span>Room occupancy</span>
                  <strong>{occupancy}%</strong>
                  <Percent />
                  <small>
                    {occupiedRooms} of {rooms.length} rooms occupied
                  </small>
                </article>

                <article className="dashboard-metric">
                  <span>Recorded revenue</span>
                  <strong>{currency(revenue)}</strong>
                  <DollarSign />
                  <small>
                    Paid reservations in selected period
                  </small>
                </article>

                <article className="dashboard-metric">
                  <span>Active reservations</span>
                  <strong>{activeBookings.length}</strong>
                  <CalendarCheck />
                  <small>
                    Excluding cancelled stays in selected period
                  </small>
                </article>

                <article className="dashboard-metric">
                  <span>Room inventory</span>
                  <strong>{rooms.length}</strong>
                  <BedDouble />
                  <small>
                    {
                      rooms.filter(
                        (room) => room.status === "available",
                      ).length
                    }{" "}
                    currently available
                  </small>
                </article>
              </div>

              <div className="dashboard-chart-grid">
                <article className="dashboard-chart-card dashboard-chart-card--wide">
                  <div className="dashboard-chart-heading">
                    <span className="dashboard-eyebrow">
                      REVENUE
                    </span>
                    <h3>Monthly recorded revenue</h3>
                  </div>

                  <div className="dashboard-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyRevenue}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="var(--dashboard-border)"
                        />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value: number) => `$${value}`}
                        />
                        <Tooltip
                          formatter={(value) =>
                            currency(Number(value))
                          }
                        />
                        <Bar
                          dataKey="revenue"
                          fill="#a88b5c"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="dashboard-chart-card">
                  <div className="dashboard-chart-heading">
                    <span className="dashboard-eyebrow">
                      INVENTORY
                    </span>
                    <h3>Rooms by category</h3>
                  </div>

                  <div className="dashboard-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={roomTypes}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={3}
                        >
                          {roomTypes.map((item, index) => (
                            <Cell
                              key={item.name}
                              fill={chartColors[index % chartColors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="dashboard-legend">
                    {roomTypes.map((item) => (
                      <span key={item.name}>
                        {item.name} <strong>{item.value}</strong>
                      </span>
                    ))}
                  </div>
                </article>

                <article className="dashboard-chart-card">
                  <div className="dashboard-chart-heading">
                    <span className="dashboard-eyebrow">
                      RESERVATIONS
                    </span>
                    <h3>Bookings by status</h3>
                  </div>

                  <div className="dashboard-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={bookingStatus}
                        layout="vertical"
                        margin={{
                          top: 4,
                          right: 12,
                          bottom: 4,
                          left: 8,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="var(--dashboard-border)"
                        />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={85}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="value"
                          name="Reservations"
                          fill="#a88b5c"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <p className="dashboard-chart-note">
                    Based on check-in dates within the selected period.
                  </p>
                </article>
              </div>

              <section className="dashboard-admin-section">
                <div className="dashboard-section-heading">
                  <div>
                    <span className="dashboard-eyebrow">
                      INVENTORY MANAGEMENT
                    </span>
                    <h2>Add a room</h2>
                  </div>
                  <span className="dashboard-muted">
                    Expand your Maison collection
                  </span>
                </div>

                <form
                  className="dashboard-room-form"
                  onSubmit={handleAddRoom}
                >
                  <div className="dashboard-room-form__fields">
                    <label>
                      Room name
                      <input
                        value={roomDraft.name}
                        onChange={(event) =>
                          updateRoomDraft("name", event.target.value)
                        }
                        placeholder="e.g. The Garden Suite"
                        maxLength={80}
                        required
                      />
                    </label>

                    <label>
                      Category
                      <select
                        value={roomDraft.type}
                        onChange={(event) =>
                          updateRoomDraft("type", event.target.value)
                        }
                      >
                        <option value="Deluxe">Deluxe</option>
                        <option value="Executive">Executive</option>
                        <option value="Suite">Suite</option>
                        <option value="Presidential">Presidential</option>
                        <option value="Residence">Residence</option>
                      </select>
                    </label>

                    <label>
                      Nightly rate (USD)
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={roomDraft.pricePerNight}
                        onChange={(event) =>
                          updateRoomDraft(
                            "pricePerNight",
                            event.target.value,
                          )
                        }
                        placeholder="250"
                        required
                      />
                    </label>

                    <label>
                      Guest capacity
                      <input
                        type="number"
                        min="1"
                        max="20"
                        step="1"
                        value={roomDraft.capacity}
                        onChange={(event) =>
                          updateRoomDraft("capacity", event.target.value)
                        }
                        required
                      />
                    </label>

                    <label className="dashboard-room-form__full">
                      Description
                      <textarea
                        value={roomDraft.description}
                        onChange={(event) =>
                          updateRoomDraft(
                            "description",
                            event.target.value,
                          )
                        }
                        placeholder="Describe the room and its atmosphere..."
                        rows={3}
                        maxLength={500}
                        required
                      />
                    </label>

                    <label className="dashboard-room-form__full">
                      Amenities
                      <input
                        value={roomDraft.amenities}
                        onChange={(event) =>
                          updateRoomDraft("amenities", event.target.value)
                        }
                        placeholder="King bed, Balcony, Ocean view"
                      />
                      <small>
                        Separate amenities with commas.
                      </small>
                    </label>
                  </div>

                  <div className="dashboard-image-upload">
                    <div className="dashboard-image-upload__heading">
                      <div>
                        <span className="dashboard-eyebrow">
                          ROOM PHOTOGRAPHY
                        </span>
                        <h3>Cover image</h3>
                      </div>
                      <span className="dashboard-muted">
                        JPG, PNG or WebP · Up to 5 MB
                      </span>
                    </div>

                    <label className="dashboard-upload-dropzone">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Preview of the new room"
                        />
                      ) : (
                        <>
                          <ImagePlus size={28} />
                          <strong>Choose an image</strong>
                          <span>
                            Select a room photograph from your device
                          </span>
                        </>
                      )}

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageChange}
                      />
                    </label>

                    {imagePreview && (
                      <button
                        className="dashboard-text-button dashboard-danger"
                        type="button"
                        onClick={() => {
                          setImagePreview("");
                          setImageError("");
                        }}
                      >
                        <X size={13} />
                        Remove image
                      </button>
                    )}

                    {imageError && (
                      <p className="dashboard-error" role="alert">
                        {imageError}
                      </p>
                    )}
                  </div>

                  {formError && (
                    <p className="dashboard-error" role="alert">
                      {formError}
                    </p>
                  )}

                  {formSuccess && (
                    <p className="dashboard-form-success" role="status">
                      {formSuccess}
                    </p>
                  )}

                  <div className="dashboard-room-form__footer">
                    <p>
                      New rooms are added with an available status.
                    </p>

                    <button
                      className="dashboard-button"
                      type="submit"
                      disabled={addRoomMutation.isPending}
                    >
                      {addRoomMutation.isPending ? (
                        <RefreshCw size={15} />
                      ) : (
                        <Plus size={15} />
                      )}
                      {addRoomMutation.isPending
                        ? "Adding room..."
                        : "Add room to inventory"}
                    </button>
                  </div>
                </form>
              </section>

              <div className="dashboard-section-heading dashboard-section-heading--past">
                <div>
                  <span className="dashboard-eyebrow">
                    ROOM OPERATIONS
                  </span>
                  <h2>Current room status</h2>
                </div>
              </div>

              {deleteError && (
                <p className="dashboard-error" role="alert">
                  {deleteError}
                </p>
              )}

              <div className="dashboard-room-grid">
                {recentRooms.map((room) => (
                  <article className="dashboard-room" key={room.id}>
                    <div className="dashboard-room__top">
                      <span className="dashboard-eyebrow">
                        {room.id}
                      </span>
                      <button
                        className="dashboard-room__delete"
                        type="button"
                        aria-label={`Delete ${room.name}`}
                        title="Delete room"
                        disabled={deleteRoomMutation.isPending}
                        onClick={() => handleDeleteRoom(room)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <strong>{room.name}</strong>
                    <span>
                      {room.type} · {room.capacity} guests
                    </span>
                    <span
                      className={`dashboard-status dashboard-status--${room.status}`}
                    >
                      {room.status}
                    </span>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <SiteFooter />
    </>
  );
}







