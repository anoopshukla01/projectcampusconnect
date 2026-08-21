/**
 * Geofence & Dwell-Time Utility
 * ==============================
 * Provides:
 * 1. Haversine distance formula calculation in meters.
 * 2. GPS accuracy threshold validation (rejects accuracy > 20m / 25m).
 * 3. `isWithinClassroom` helper function.
 * 4. Dwell-time state evaluation for anti-spoofing and zero-touch check-ins.
 */

// Earth radius in meters
const EARTH_RADIUS_METERS = 6371000;

// Maximum acceptable GPS accuracy in meters (higher uncertainty means unreliable ping)
export const MAX_GPS_ACCURACY_METERS = 20;

// Default classroom geofence radius in meters
export const DEFAULT_GEOFENCE_RADIUS_METERS = 25;

// Required continuous dwell duration in milliseconds before zero-touch checkin is confirmed
export const REQUIRED_DWELL_MS = 15000; // 15 seconds

/**
 * Calculates the great-circle distance between two GPS coordinates using the Haversine formula.
 * @param {number} lat1 - Latitude of point 1 in degrees
 * @param {number} lon1 - Longitude of point 1 in degrees
 * @param {number} lat2 - Latitude of point 2 in degrees
 * @param {number} lon2 - Longitude of point 2 in degrees
 * @returns {number} Distance in meters rounded to 2 decimal places
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return Infinity;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = EARTH_RADIUS_METERS * c;
  return Math.round(distance * 100) / 100;
}

/**
 * Evaluates whether a user's current GPS coordinate ping is within the target classroom geofence.
 *
 * @param {number} userLat - User latitude
 * @param {number} userLng - User longitude
 * @param {number} accuracy - GPS horizontal accuracy radius in meters
 * @param {{ latitude: number, longitude: number, radiusMeters?: number }} classroom - Target classroom coordinates
 * @param {number} [maxAccuracy=MAX_GPS_ACCURACY_METERS] - Max allowable accuracy tolerance
 * @returns {{ inRange: boolean, distance: number, accuracyAccepted: boolean, radius: number }}
 */
export function isWithinClassroom(
  userLat,
  userLng,
  accuracy,
  classroom,
  maxAccuracy = MAX_GPS_ACCURACY_METERS
) {
  if (!classroom || classroom.latitude === undefined || classroom.longitude === undefined) {
    return { inRange: false, distance: Infinity, accuracyAccepted: false, radius: DEFAULT_GEOFENCE_RADIUS_METERS };
  }

  const accuracyAccepted = accuracy !== undefined && accuracy !== null && accuracy <= maxAccuracy;
  const radius = classroom.radiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS;

  const distance = calculateHaversineDistance(
    userLat,
    userLng,
    classroom.latitude,
    classroom.longitude
  );

  const inRange = distance <= radius;

  return {
    inRange,
    distance,
    accuracyAccepted,
    radius,
  };
}

/**
 * Evaluates dwell progress percentage towards the required dwell threshold.
 * @param {number|null} dwellStartTime - Timestamp when user first entered the geofence
 * @param {number} [requiredDwell=REQUIRED_DWELL_MS] - Total required duration in ms
 * @returns {{ dwellMs: number, progressPct: number, dwellComplete: boolean }}
 */
export function getDwellProgress(dwellStartTime, requiredDwell = REQUIRED_DWELL_MS) {
  if (!dwellStartTime) {
    return { dwellMs: 0, progressPct: 0, dwellComplete: false };
  }

  const elapsed = Date.now() - dwellStartTime;
  const progressPct = Math.min(100, Math.round((elapsed / requiredDwell) * 100));
  const dwellComplete = elapsed >= requiredDwell;

  return {
    dwellMs: elapsed,
    progressPct,
    dwellComplete,
  };
}
