export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const ADMIN_API_KEY =
  import.meta.env.VITE_ADMIN_API_KEY || '';

export const ADMIN_HEADER = ADMIN_API_KEY
  ? { 'x-admin-key': ADMIN_API_KEY }
  : {};

// Used by the homepage
export const LOCATION_NAME = 'Oceanview Driving Range, Half Moon Bay';
export const GOOGLE_MAPS_LINK = 'https://maps.google.com/?q=Oceanview+Driving+Range+Half+Moon+Bay';

// Booking prices (card prices). Cash discount is handled server-side.
export const PRICES = [
  { minutes: 30, price: 90 },
  { minutes: 45, price: 135 },
  { minutes: 60, price: 180 }
];
