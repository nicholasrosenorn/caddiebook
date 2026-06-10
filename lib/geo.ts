export type LatLng = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6371000;
const YARDS_PER_METER = 1.09361;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Initial great-circle bearing from `a` to `b`, in degrees [0, 360). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * The point `meters` away from `origin` along `bearing` (degrees clockwise
 * from north). Negative `meters` walks the reciprocal bearing.
 */
export function destinationPoint(origin: LatLng, bearing: number, meters: number): LatLng {
  const delta = meters / EARTH_RADIUS_M;
  const theta = toRad(bearing);
  const lat1 = toRad(origin.latitude);
  const lon1 = toRad(origin.longitude);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(theta),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(lat1),
      Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { latitude: toDeg(lat2), longitude: toDeg(lon2) };
}

/** Great-circle distance between two coordinates, in yards. */
export function haversineYards(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;
  const meters = 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
  return meters * YARDS_PER_METER;
}
