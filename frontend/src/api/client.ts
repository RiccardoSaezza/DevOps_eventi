import type {
  ApiErrorDetail,
  AuthResponse,
  Booking,
  Event,
  EventFilters,
  EventType,
  User,
} from '../types';

const TOKEN_KEY = 'accordo.token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];

  constructor(
    message: string,
    status: number,
    code = 'API_ERROR',
    details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getStoredToken();

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.auth !== false && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(
      'Impossibile contattare il server. Controlla la connessione e riprova.',
      0,
      'NETWORK_ERROR',
    );
  }

  if (!response.ok) {
    let payload: {
      error?: { message?: string; code?: string; details?: ApiErrorDetail[] };
    } = {};
    try {
      payload = await response.json();
    } catch {
      // risposta non JSON: manteniamo il messaggio generico
    }
    throw new ApiError(
      payload.error?.message ?? 'Si è verificato un errore. Riprova.',
      response.status,
      payload.error?.code ?? 'API_ERROR',
      payload.error?.details,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function toQuery(filters: EventFilters): string {
  const params = new URLSearchParams({ period: 'upcoming', limit: '60' });
  if (filters.q) params.set('q', filters.q);
  if (filters.type) params.set('type', filters.type);
  if (filters.available) params.set('available', 'true');
  if (filters.from) params.set('from', filters.from);
  return params.toString();
}

export const api = {
  auth: {
    register: (input: {
      name: string;
      email: string;
      password: string;
      organizerCode?: string;
    }) =>
      request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: input,
        auth: false,
      }),
    login: (input: { email: string; password: string }) =>
      request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: input,
        auth: false,
      }),
    me: () => request<{ user: User }>('/auth/me'),
  },
  events: {
    list: (filters: EventFilters = {}) =>
      request<{ events: Event[]; meta: { page: number; limit: number; total: number } }>(
        `/events?${toQuery(filters)}`,
        { auth: false },
      ),
    get: (id: string) => request<{ event: Event }>(`/events/${id}`, { auth: false }),
    mine: () => request<{ events: Event[] }>('/events/mine'),
    create: (input: {
      title: string;
      description: string;
      type: EventType;
      startsAt: string;
      location: string;
      capacity: number;
    }) => request<{ event: Event }>('/events', { method: 'POST', body: input }),
    update: (
      id: string,
      input: {
        title: string;
        description: string;
        type: EventType;
        startsAt: string;
        location: string;
        capacity: number;
      },
    ) => request<{ event: Event }>(`/events/${id}`, { method: 'PUT', body: input }),
    cancel: (id: string) =>
      request<{ event: Event; cancelledBookings: number }>(`/events/${id}/cancel`, {
        method: 'POST',
      }),
    book: (id: string) =>
      request<{ booking: Booking }>(`/events/${id}/bookings`, { method: 'POST' }),
  },
  bookings: {
    mine: () => request<{ bookings: Booking[] }>('/bookings/me'),
    cancel: (id: string) =>
      request<{ booking: Booking }>(`/bookings/${id}`, { method: 'DELETE' }),
  },
};
