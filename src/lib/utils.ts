export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n || 0);
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  village?: string;
  district?: string;
  state?: string;
}

export function getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, enableHighAccuracy: false },
    );
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<{ village?: string; district?: string; state?: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&accept-language=en`,
      { headers: { 'Accept': 'application/json' } },
    );
    if (!res.ok) return {};
    const data = await res.json();
    const a = data?.address ?? {};
    return {
      village: a.village || a.town || a.suburb || a.village || a.hamlet || a.county || undefined,
      district: a.county || a.state_district || a.district || undefined,
      state: a.state || undefined,
    };
  } catch {
    return {};
  }
}

export async function detectLocation(): Promise<GeoLocation | null> {
  const coords = await getCurrentPosition();
  if (!coords) return null;
  const place = await reverseGeocode(coords.latitude, coords.longitude);
  return { ...coords, ...place };
}
