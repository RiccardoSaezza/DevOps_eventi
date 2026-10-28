import type { BookingStatus, EventStatus, EventType } from '../types';
import { EVENT_TYPE_LABEL } from '../utils/date';

export function EventTypeBadge({ type }: { type: EventType }) {
  return (
    <span className={`badge badge--type badge--${type.toLowerCase()}`}>
      {EVENT_TYPE_LABEL[type]}
    </span>
  );
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <span className={`badge ${status === 'PUBBLICATO' ? 'badge--live' : 'badge--cancelled'}`}>
      {status === 'PUBBLICATO' ? 'In vendita' : 'Annullato'}
    </span>
  );
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`badge ${status === 'CONFERMATA' ? 'badge--confirmed' : 'badge--cancelled'}`}>
      {status === 'CONFERMATA' ? 'Confermata' : 'Annullata'}
    </span>
  );
}
