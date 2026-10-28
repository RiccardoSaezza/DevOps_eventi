export type Role = 'PARTECIPANTE' | 'ORGANIZZATORE';
export type EventType = 'CONCERTO' | 'WORKSHOP' | 'DJ_SET';
export type EventStatus = 'PUBBLICATO' | 'ANNULLATO';
export type BookingStatus = 'CONFERMATA' | 'ANNULLATA';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface EventDto {
  id: string;
  title: string;
  description: string;
  type: EventType;
  startsAt: string;
  location: string;
  capacity: number;
  status: EventStatus;
  createdBy: string;
  organizerName: string;
  bookedCount: number;
  availableSeats: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookingDto {
  id: string;
  eventId: string;
  userId: string;
  status: BookingStatus;
  seatNumber: number | null;
  createdAt: string;
  cancelledAt: string | null;
  event?: {
    id: string;
    title: string;
    type: EventType;
    startsAt: string;
    location: string;
    status: EventStatus;
  };
}
