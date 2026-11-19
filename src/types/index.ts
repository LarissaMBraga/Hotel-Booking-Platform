export type UserRole = "guest" | "receptionist" | "admin";

export type RoomStatus =
  | "available"
  | "booked"
  | "occupied"
  | "cleaning";

export interface Room {
  id: string;
  name: string;
  type: string;
  description: string;
  pricePerNight: number;
  capacity: number;
  status: RoomStatus;
  amenities: string[];
  images: string[];
  rating: number;
  reviewCount: number;
}

export interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface Booking {
  id: string;
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  status: "confirmed" | "checked-in" | "completed" | "cancelled";
  services: string[];
  totalPrice: number;
  guestCount?: number;
  paymentStatus?: "pending" | "simulated" | "settled-demo" | "paid" | "refunded";
  paymentMethod?: "card" | "pix" | "paypal" | "pay-at-hotel";
}

export interface HotelService {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface Review {
  id: string;
  bookingId: string;
  guestId: string;
  guestName: string;
  roomId: string;
  rating: number;
  comment: string;
  createdAt: string;
}