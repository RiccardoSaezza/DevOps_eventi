import type { EventType } from '../types';

const longDate = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const shortDate = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
});

const monthOnly = new Intl.DateTimeFormat('it-IT', { month: 'short' });

const dayOnly = new Intl.DateTimeFormat('it-IT', { day: '2-digit' });

const timeOnly = new Intl.DateTimeFormat('it-IT', {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateLong(iso: string): string {
  return longDate.format(new Date(iso));
}

export function formatDateShort(iso: string): string {
  return shortDate.format(new Date(iso)).replace('.', '');
}

export function formatMonth(iso: string): string {
  return monthOnly.format(new Date(iso)).replace('.', '').toUpperCase();
}

export function formatDay(iso: string): string {
  return dayOnly.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeOnly.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return `${formatDateLong(iso)} · ore ${formatTime(iso)}`;
}

export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function pluralizePosti(count: number): string {
  return count === 1 ? 'posto' : 'posti';
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  CONCERTO: 'Concerto',
  WORKSHOP: 'Workshop',
  DJ_SET: 'DJ set',
};

export const EVENT_TYPE_DESCRIPTION: Record<EventType, string> = {
  CONCERTO: 'Posti numerati assegnati automaticamente',
  WORKSHOP: 'Posti limitati, prenotazione consigliata',
  DJ_SET: 'Ingresso libero fino a esaurimento capienza',
};
