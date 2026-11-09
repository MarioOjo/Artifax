import { apiErrorMessage, isNetworkError, isReadOnlyDemo, OFFLINE_MESSAGE } from './apiErrors';

const axiosError = (response?: { status: number; data: unknown }) =>
  Object.assign(new Error('Request failed'), { isAxiosError: true, response });

describe('apiErrorMessage', () => {
  it('uses the server message from a JSON refusal', () => {
    const error = axiosError({ status: 403, data: { message: 'The demo account is read-only, so changes are disabled.' } });
    expect(apiErrorMessage(error, 'fallback')).toBe('The demo account is read-only, so changes are disabled.');
  });

  it('uses a plain-text refusal', () => {
    expect(apiErrorMessage(axiosError({ status: 400, data: 'Email already in use' }), 'fallback')).toBe('Email already in use');
  });

  it('falls back for server errors, whose bodies are not meant for users', () => {
    expect(apiErrorMessage(axiosError({ status: 500, data: 'NullReferenceException' }), 'fallback')).toBe('fallback');
  });

  it('explains when the server could not be reached', () => {
    expect(apiErrorMessage(axiosError(undefined), 'fallback')).toBe(OFFLINE_MESSAGE);
    expect(isNetworkError(new Error('Network Error'))).toBe(true);
    expect(isNetworkError(new Error('Fetch error 404 Not Found'))).toBe(false);
  });
});

describe('isReadOnlyDemo', () => {
  it('is true only for the Demo role', () => {
    expect(isReadOnlyDemo({ role: 'Demo' })).toBe(true);
    expect(isReadOnlyDemo({ role: 'Admin' })).toBe(false);
    expect(isReadOnlyDemo(null)).toBe(false);
  });
});
