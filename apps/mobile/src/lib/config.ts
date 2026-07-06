import Constants from 'expo-constants';

/**
 * API base URL. Defaults to production (armory.michondr.space) from app.json's
 * `extra.apiUrl`. For local dev against a LAN API, set EXPO_PUBLIC_API_URL to
 * your machine's IP, e.g. http://192.168.1.20:3000/api (localhost won't work
 * from a phone).
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'https://armory.michondr.space/api';
