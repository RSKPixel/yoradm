import * as Application from 'expo-application';
import { getCreds } from './device';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8003/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

// Errors that mean the phone itself is no longer trusted.
export const DEVICE_LOST = new Set(['device_revoked', 'device_unknown']);

// Access token lives in memory only; the phone's credentials are in SecureStore.
let accessToken: string | null = null;
let onDeviceLost: (message?: string) => void = () => {};
let starting: Promise<void> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setDeviceLostHandler(fn: (message?: string) => void) {
  onDeviceLost = fn;
}

async function request(path: string, init: RequestInit, auth: boolean): Promise<Response> {
  if (!__DEV__ && !BASE.startsWith('https://')) {
    throw new ApiError('Insecure server address', 0);
  }
  try {
    return await fetch(BASE + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError('Cannot reach server. Check your connection.', 0);
  }
}

async function toError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  const detail = body?.detail;
  // FastAPI validation errors arrive as a list of { msg }.
  const msg = Array.isArray(body?.errors)
    ? body.errors
        .map((d: { msg: string; loc?: unknown[] }) => {
          const field = d.loc?.length ? `${String(d.loc[d.loc.length - 1])}: ` : '';
          return field + String(d.msg).replace(/^Value error, /, '');
        })
        .join('\n')
    : typeof detail === 'string'
      ? detail
      : `Request failed (${res.status})`;
  return new ApiError(msg, res.status, body?.code);
}

async function failed(res: Response): Promise<ApiError> {
  const err = await toError(res);
  if (err.code && DEVICE_LOST.has(err.code)) onDeviceLost(err.message);
  return err;
}

/** Trade the phone's stored credentials for a short-lived access token. */
export function startSession(): Promise<void> {
  starting ??= (async () => {
    try {
      const creds = await getCreds();
      if (!creds) {
        onDeviceLost();
        throw new ApiError('This phone is not activated', 401, 'device_unknown');
      }
      const body = JSON.stringify({ ...creds, app_version: Application.nativeApplicationVersion });
      const res = await request('/m/session', { method: 'POST', body }, false);
      if (!res.ok) throw await failed(res);
      setAccessToken((await res.json()).access_token);
    } finally {
      starting = null;
    }
  })();
  return starting;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await request(path, init, true);
  if (res.status === 401) {
    const err = await failed(res);
    if (err.code && DEVICE_LOST.has(err.code)) throw err;
    // Token expired (they last 15 minutes): start a new session and retry once.
    await startSession();
    res = await request(path, init, true);
  }
  if (!res.ok) throw await failed(res);
  return res.status === 204 ? (undefined as T) : res.json();
}

export async function activateDevice<T>(body: object): Promise<T> {
  const res = await request('/m/activate', { method: 'POST', body: JSON.stringify(body) }, false);
  if (!res.ok) throw await toError(res);
  return res.json();
}

export function qs(params: Record<string, string | number | undefined>) {
  const s = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return s ? `?${s}` : '';
}

export type Me = {
  name: string;
  company_name: string;
  reps: string[];
  device_model: string | null;
  activated_at: string | null;
};

export type Buckets = {
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_91_120: number;
  bucket_above_120: number;
  bucket_undated: number;
  total: number;
  invoice_count: number;
};

export type Summary = {
  as_of: string;
  synced_at: string | null;
  totals: Buckets;
  reps: { name: string; total: number; invoice_count: number }[];
};

export type PartyRow = Buckets & { ledger_name: string; oldest_days: number | null };

export type Bill = {
  invoice_no: string | null;
  invoice_date: string | null;
  due_date: string | null;
  representative: string | null;
  amount: number;
  days: number | null;
  age_bucket: string;
};

export type InvoiceLine = {
  stock_item: string | null;
  brand: string | null;
  packing: number | null;
  qty: number | null;
  qty_alt: number | null;
  alternate_unit: string | null;
  rate: number | null;
  amount: number | null;
  discount: number | null;
  cartage: number | null;
};

export type InvoiceDetail = {
  invoice_no: string;
  ledger_name: string;
  invoice_date: string | null;
  representative: string | null;
  outstanding: number;
  days: number | null;
  found: boolean;
  broker: string | null;
  lines: InvoiceLine[];
  total_qty: number;
  total_amount: number;
};

export type PartyDetail = {
  ledger_name: string;
  phone: string | null;
  mobile: string | null;
  totals: Buckets;
  bills: Bill[];
};
