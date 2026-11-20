import { ArrowUpRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import type { Room } from "@/types";
import { formatCurrency } from "@/lib/utils";

type RoomCardProps = {
  room: Room;
};

const roomImages: Record<string, string> = {
  standard:
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=75",
  deluxe:
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=75",
  suite:
    "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=75",
  default:
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=75",
};

function getRoomImage(room: Room) {
  const roomType = String(room.type ?? "").toLowerCase();

  if (roomType.includes("suite")) return roomImages.suite;
  if (roomType.includes("deluxe")) return roomImages.deluxe;
  if (roomType.includes("standard")) return roomImages.standard;
  return roomImages.default;
}

export function RoomCard({ room }: RoomCardProps) {
  return (
    <article className="room-card">
      <Link
        className="room-card__image-link"
        to={`/rooms/${room.id}`}
        aria-label={`View ${room.name}`}
      >
        <img
          className="room-card__image"
          src={room.images?.[0] || getRoomImage(room)}
          alt={room.name}
          loading="lazy"
        />
        <span className="room-card__image-action" aria-hidden="true">
          <ArrowUpRight size={19} />
        </span>
      </Link>

      <div className="room-card__content">
        <div className="room-card__heading">
          <h3>{room.name}</h3>
          <span className="room-card__rating">
            <Star size={13} fill="currentColor" />
            {room.rating.toFixed(1)}
          </span>
        </div>

        <p className="room-card__description">{room.description}</p>

        <div className="room-card__meta">
          <span>Up to {room.capacity} guests</span>
          <span>{room.type}</span>
        </div>

        <div className="room-card__bottom">
          <p className="room-card__price">
            <strong>{formatCurrency(room.pricePerNight)}</strong>
            <span> / night</span>
          </p>
          <Link className="room-card__details" to={`/rooms/${room.id}`}>
            View details <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
