export type Role = 'PARTECIPANTE' | 'ORGANIZZATORE';
export type EventType = 'CONCERTO' | 'WORKSHOP' | 'DJ_SET';
export type EventStatus = 'PUBBLICATO' | 'ANNULLATO';
export type BookingStatus = 'CONFERMATA' | 'ANNULLATA';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Event {
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

export interface Booking {
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

export interface AuthResponse {
  token: string;
  user: User;
}

export interface EventFilters {
  q?: string;
  type?: EventType;
  available?: boolean;
  from?: string;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}
