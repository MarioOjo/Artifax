import axios from 'axios';

const rawApiBase = process.env.REACT_APP_API_BASE || 'https://artifax-x8pr.onrender.com';
const normalizedApiBase = rawApiBase.replace(/\/+$/, '');
const API_BASE = normalizedApiBase.endsWith('/api') ? normalizedApiBase : `${normalizedApiBase}/api`;

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function toFetchStyleError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const statusText = error.response?.statusText;

    if (status != null) {
      return new Error(`Fetch error ${status} ${statusText ?? ''}`.trim());
    }

    if (error.message) {
      return new Error(error.message);
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Request failed');
}

export default apiClient;