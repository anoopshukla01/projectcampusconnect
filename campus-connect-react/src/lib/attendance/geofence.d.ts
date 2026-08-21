/**
 * Type declarations for GPS Geofenced Attendance Engine
 */

export interface ClassroomCoordinates {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  name?: string;
  code?: string;
  block?: string;
  floor?: number;
}

export interface GeofenceEvaluationResult {
  inRange: boolean;
  distance: number;
  accuracyAccepted: boolean;
  radius: number;
}

export interface DwellProgressResult {
  dwellMs: number;
  progressPct: number;
  dwellComplete: boolean;
}

export declare function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number;

export declare function isWithinClassroom(
  userLat: number,
  userLng: number,
  accuracy: number,
  classroom: ClassroomCoordinates,
  maxAccuracy?: number
): GeofenceEvaluationResult;

export declare function getDwellProgress(
  dwellStartTime: number | null,
  requiredDwell?: number
): DwellProgressResult;
