import { ArrowUpRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Event } from '../types';
import {
  formatDay,
  formatMonth,
  formatTime,
  pluralizePosti,
} from '../utils/date';
import { EventTypeBadge } from './Badges';

export function AvailabilityBar({
  booked,
  capacity,
  compact = false,
}: {
  booked: number;
  capacity: number;
  compact?: boolean;
}) {
  const percent = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
  return (
    <div className={`availability ${compact ? 'availability--compact' : ''}`}>
      <div
        className="availability__track"
        role="progressbar"
        aria-valuenow={booked}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-label={`${booked} posti prenotati su ${capacity}`}
      >
        <span className="availability__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function EventCard({ event, index = 0 }: { event: Event; index?: number }) {
  const soldOut = event.availableSeats <= 0;
  return (
    <Link
      to={`/events/${event.id}`}
      className={`event-card ${soldOut ? 'event-card--soldout' : ''}`}
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <div className="event-card__top">
        <div className="date-chip" aria-label={new Date(event.startsAt).toDateString()}>
          <span className="date-chip__month">{formatMonth(event.startsAt)}</span>
          <span className="date-chip__day">{formatDay(event.startsAt)}</span>
          <span className="date-chip__time">{formatTime(event.startsAt)}</span>
        </div>
        <div className="event-card__badges">
          <EventTypeBadge type={event.type} />
          {soldOut && <span className="badge badge--soldout">Esaurito</span>}
        </div>
      </div>

      <div className="event-card__body">
        <h3>{event.title}</h3>
        <p className="event-card__location">
          <MapPin size={15} aria-hidden="true" />
          {event.location}
        </p>
      </div>

      <div className="event-card__footer">
        <div className="event-card__seats">
          <span>{soldOut ? 'Nessun posto disponibile' : `${event.availableSeats} ${pluralizePosti(event.availableSeats)} liberi`}</span>
          <AvailabilityBar booked={event.bookedCount} capacity={event.capacity} compact />
        </div>
        <span className="event-card__arrow" aria-hidden="true">
          <ArrowUpRight size={20} />
        </span>
      </div>
    </Link>
  );
}
