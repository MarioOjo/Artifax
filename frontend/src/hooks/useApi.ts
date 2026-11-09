import axios from 'axios';

const rawApiBase = process.env.REACT_APP_API_BASE || 'https://artifax-x8pr.onrender.com';
const normalizedApiBase = rawApiBase.replace(/\/+$/, '');
const API_BASE_URL = normalizedApiBase.endsWith('/api') ? normalizedApiBase : `${normalizedApiBase}/api`;

// Create a singleton axios instance to ensure session cookies persist across requests
const apiInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send session cookies with every request
});

/**
 * Export the raw axios instance for use in non-React modules (services)
 */
export const api = apiInstance;

/**
 * Custom hook that returns the shared axios instance
 * with the API base URL already set.
 * 
 * Using a singleton ensures session cookies are properly maintained
 * across all API calls.
 */
export const useApi = () => {
  return apiInstance;
};