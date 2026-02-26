const BASE_URL = '/api';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'X-Actor': 'alice',
  'X-Role': 'admin',
};

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...DEFAULT_HEADERS, ...options.headers },
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    const msg = json?.error?.message || 'Request failed';
    throw new Error(msg);
  }

  return json;
}

// ─── Types ─────────────────────────────────────────────────────────────

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
  tags: { id: string; name: string }[];
  events?: TicketEvent[];
}

export interface TicketEvent {
  id: string;
  ticketId: string;
  actor: string;
  eventType: string;
  meta?: any;
  createdAt: string;
}

export interface ListResponse {
  success: boolean;
  data: Ticket[];
  meta: { nextCursor: string | null };
}

// ─── API Methods ────────────────────────────────────────────────────────

export const api = {
  tickets: {
    list: (params: Record<string, string> = {}): Promise<ListResponse> => {
      const qs = new URLSearchParams(params).toString();
      return apiFetch(`/tickets${qs ? `?${qs}` : ''}`);
    },

    get: (id: string): Promise<{ success: boolean; data: Ticket }> =>
      apiFetch(`/tickets/${id}`),

    create: (
      payload: any,
      idempotencyKey?: string,
    ): Promise<{ success: boolean; data: Ticket }> =>
      apiFetch('/tickets', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
      }),

    updateStatus: (
      id: string,
      status: string,
    ): Promise<{ success: boolean; data: Ticket }> =>
      apiFetch(`/tickets/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },
};
