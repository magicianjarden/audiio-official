/**
 * API Helper Utilities
 *
 * Safe wrappers for window.api calls with error handling and fallbacks.
 */

/**
 * Check if window.api is available (running in Electron with IPC)
 */
export function hasApi(): boolean {
  return typeof window !== 'undefined' && window.api !== undefined;
}

/**
 * Safe API call with fallback value and error logging
 *
 * @param fn - The async function to call
 * @param fallback - Value to return if the call fails
 * @param context - Description for error logging
 * @returns The result or fallback value
 *
 * @example
 * const tags = await safeApiCall(
 *   () => window.api!.tags.getAll(),
 *   { tags: [] },
 *   'getTags'
 * );
 */
export async function safeApiCall<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> {
  if (!hasApi()) {
    console.warn(`[safeApiCall] API not available for ${context}`);
    return fallback;
  }

  try {
    return await fn();
  } catch (error) {
    console.error(`[safeApiCall] ${context} failed:`, error);
    return fallback;
  }
}

/**
 * Safe API call that returns null on error instead of a fallback
 *
 * @param fn - The async function to call
 * @param context - Description for error logging
 * @returns The result or null
 */
export async function safeApiCallNullable<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T | null> {
  if (!hasApi()) {
    console.warn(`[safeApiCall] API not available for ${context}`);
    return null;
  }

  try {
    return await fn();
  } catch (error) {
    console.error(`[safeApiCall] ${context} failed:`, error);
    return null;
  }
}

/**
 * Safe API call with custom error handler
 *
 * @param fn - The async function to call
 * @param onError - Custom error handler
 * @param context - Description for error logging
 * @returns The result or undefined
 */
export async function safeApiCallWithHandler<T>(
  fn: () => Promise<T>,
  onError: (error: unknown, context: string) => void,
  context: string
): Promise<T | undefined> {
  if (!hasApi()) {
    onError(new Error('API not available'), context);
    return undefined;
  }

  try {
    return await fn();
  } catch (error) {
    onError(error, context);
    return undefined;
  }
}

/**
 * Type guard to check if a value is a success response
 */
export function isSuccessResponse(
  response: unknown
): response is { success: boolean } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    typeof (response as { success: unknown }).success === 'boolean'
  );
}

/**
 * Type guard to check if a response indicates success
 */
export function wasSuccessful(response: unknown): boolean {
  return isSuccessResponse(response) && response.success === true;
}
