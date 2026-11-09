import axios from 'axios';

export const OFFLINE_MESSAGE = "Couldn't reach the server. Check your connection and try again.";
export const READ_ONLY_MESSAGE = 'The demo account is read-only, so changes are disabled.';

// True when the request never got a response (server asleep, offline, DNS...), rather than being refused
export function isNetworkError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return !error.response;
  }
  // orderApi/inventoryApi rethrow plain Errors: a status means the server answered
  if (error instanceof Error) {
    return (error as Error & { status?: number }).status == null && /network error|failed to fetch|timeout/i.test(error.message);
  }
  return false;
}

// A message to show the user: the server's own explanation when it gave one, otherwise the fallback
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (isNetworkError(error)) {
    return OFFLINE_MESSAGE;
  }

  if (axios.isAxiosError(error) && error.response) {
    const { status, data } = error.response;
    if (status < 500) {
      if (typeof data === 'string' && data.trim()) return data;
      if (data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string') {
        return (data as { message: string }).message;
      }
    }
  }

  return fallback;
}

export function isReadOnlyDemo(user: { role?: string | null } | null | undefined): boolean {
  return user?.role?.toString().toLowerCase() === 'demo';
}
