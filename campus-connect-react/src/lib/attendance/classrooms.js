/**
 * Campus Classroom Geofence Registry
 * ==================================
 * Maps standard college classrooms, seminar halls, and laboratories
 * to GPS coordinates and custom geofence radius boundaries.
 */

export const CAMPUS_CENTER = {
  latitude: 28.6139,
  longitude: 77.2090,
  name: 'Main Campus Center',
  radiusMeters: 500,
};

export const CLASSROOM_REGISTRY = {
  // Academic Block A
  'Room 101': {
    code: 'A-101',
    name: 'Lecture Hall 101',
    block: 'Block A (Engineering)',
    floor: 1,
    latitude: 28.614120,
    longitude: 77.209150,
    radiusMeters: 25,
  },
  'Room 102': {
    code: 'A-102',
    name: 'Lecture Hall 102',
    block: 'Block A (Engineering)',
    floor: 1,
    latitude: 28.614210,
    longitude: 77.209220,
    radiusMeters: 25,
  },
  'Room 201': {
    code: 'A-201',
    name: 'Lecture Hall 201',
    block: 'Block A (Engineering)',
    floor: 2,
    latitude: 28.614130,
    longitude: 77.209160,
    radiusMeters: 25,
  },
  'Room 202': {
    code: 'A-202',
    name: 'Seminar Room 202',
    block: 'Block A (Engineering)',
    floor: 2,
    latitude: 28.614230,
    longitude: 77.209240,
    radiusMeters: 25,
  },
  'Room 301': {
    code: 'A-301',
    name: 'Advanced CS Classroom 301',
    block: 'Block A (Computer Science)',
    floor: 3,
    latitude: 28.614150,
    longitude: 77.209170,
    radiusMeters: 25,
  },
  'Room 302': {
    code: 'A-302',
    name: 'Software Engineering Hall 302',
    block: 'Block A (Computer Science)',
    floor: 3,
    latitude: 28.614250,
    longitude: 77.209260,
    radiusMeters: 25,
  },

  // Labs & Specialized Centers
  'Lab 1': {
    code: 'L-1',
    name: 'Computer Networks Lab',
    block: 'IT Complex',
    floor: 1,
    latitude: 28.614400,
    longitude: 77.209400,
    radiusMeters: 30,
  },
  'Lab 2': {
    code: 'L-2',
    name: 'AI & Data Science Lab',
    block: 'IT Complex',
    floor: 2,
    latitude: 28.614420,
    longitude: 77.209420,
    radiusMeters: 30,
  },
  'Audi 1': {
    code: 'AUDI-1',
    name: 'Grand Auditorium',
    block: 'Student Activity Center',
    floor: 1,
    latitude: 28.613800,
    longitude: 77.208800,
    radiusMeters: 45,
  },
};

/**
 * Resolves a classroom configuration by room name or code.
 * Falls back to default block coordinates if room is not explicitly mapped.
 *
 * @param {string} roomName - e.g. "Room 302", "Lab 1", "Audi 1"
 * @returns {{ latitude: number, longitude: number, radiusMeters: number, name: string, code: string }}
 */
export function getClassroomGeofence(roomName) {
  if (!roomName) return CAMPUS_CENTER;

  const normalized = roomName.trim();
  if (CLASSROOM_REGISTRY[normalized]) {
    return CLASSROOM_REGISTRY[normalized];
  }

  // Check case-insensitive match or code match
  const found = Object.entries(CLASSROOM_REGISTRY).find(([key, val]) =>
    key.toLowerCase() === normalized.toLowerCase() ||
    val.code.toLowerCase() === normalized.toLowerCase()
  );

  if (found) return found[1];

  // Dynamic fallback based on room number format
  return {
    code: normalized,
    name: normalized,
    block: 'Academic Block',
    floor: 1,
    latitude: CAMPUS_CENTER.latitude,
    longitude: CAMPUS_CENTER.longitude,
    radiusMeters: 30,
  };
}
