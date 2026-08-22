import Dexie from 'dexie';

class CampusConnectOfflineDB extends Dexie {
  constructor() {
    super('CampusConnectOfflineDB');
    this.version(1).stores({
      profiles: 'id, role, updatedAt',
      schedules: 'id, dayOfWeek',
      attendance: 'id, lastSynced',
      broadcasts: 'id, category, createdAt'
    });
  }
}

export const offlineDB = new CampusConnectOfflineDB();

// ── Cache Access & Persistence Helpers ──────────────────────────────────────────

/**
 * Cache Virtual ID / User Profile snapshot
 */
export async function cacheUserProfile(profile) {
  if (!profile || !profile.id) return;
  try {
    await offlineDB.profiles.put({
      id: String(profile.id),
      role: profile.role || 'student',
      name: profile.name || profile.full_name || '',
      email: profile.email || '',
      rollNo: profile.roll_no || profile.rollNo || '',
      batch: profile.batch || '',
      department: profile.branch || profile.department || '',
      photoUrl: profile.profile_image_url || profile.photoUrl || '',
      qrPayload: JSON.stringify({
        id: profile.id,
        roll: profile.roll_no || profile.rollNo,
        email: profile.email,
        validUntil: '2027-06-30'
      }),
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Failed to cache user profile in IndexedDB:', err);
  }
}

export async function getCachedUserProfile(userId) {
  if (!userId) return null;
  try {
    return await offlineDB.profiles.get(String(userId));
  } catch (err) {
    console.warn('Failed to read cached profile from IndexedDB:', err);
    return null;
  }
}

/**
 * Cache Timetable / Schedule snapshot
 */
export async function cacheSchedule(scheduleItems) {
  if (!Array.isArray(scheduleItems) || scheduleItems.length === 0) return;
  try {
    await offlineDB.schedules.clear();
    const items = scheduleItems.map((item, idx) => ({
      id: String(item.id || idx),
      subject: item.course_name || item.subject || 'Lecture',
      room: item.room || 'TBD',
      startTime: item.time_slot ? item.time_slot.split('-')[0] : '',
      endTime: item.time_slot ? item.time_slot.split('-')[1] : '',
      dayOfWeek: item.day_of_week || item.day || 'Monday',
      lastSynced: new Date().toISOString()
    }));
    await offlineDB.schedules.bulkPut(items);
  } catch (err) {
    console.warn('Failed to cache timetable in IndexedDB:', err);
  }
}

export async function getCachedSchedule() {
  try {
    return await offlineDB.schedules.toArray();
  } catch (err) {
    console.warn('Failed to read cached timetable:', err);
    return [];
  }
}

/**
 * Cache Attendance Summary & Logs snapshot
 */
export async function cacheAttendance(attendanceData) {
  if (!attendanceData) return;
  try {
    await offlineDB.attendance.put({
      id: 'current_user_attendance',
      overallPercentage: attendanceData.overallPercentage ?? attendanceData.overall ?? 0,
      totalAttended: attendanceData.totalAttended ?? attendanceData.attended ?? 0,
      totalConducted: attendanceData.totalConducted ?? attendanceData.total ?? 0,
      subjectBreakdown: attendanceData.subjects || attendanceData.subjectBreakdown || [],
      recentLogs: attendanceData.recentLogs || [],
      lastSynced: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Failed to cache attendance in IndexedDB:', err);
  }
}

export async function getCachedAttendance() {
  try {
    return await offlineDB.attendance.get('current_user_attendance');
  } catch (err) {
    console.warn('Failed to read cached attendance:', err);
    return null;
  }
}

/**
 * Cache Broadcasts & Announcements snapshot
 */
export async function cacheBroadcasts(broadcastList) {
  if (!Array.isArray(broadcastList) || broadcastList.length === 0) return;
  try {
    const formatted = broadcastList.slice(0, 50).map(b => ({
      id: String(b.id || Math.random()),
      title: b.title || 'Announcement',
      content: b.content || b.description || '',
      author: b.author || b.posted_by || 'Campus Administration',
      createdAt: b.created_at || b.createdAt || new Date().toISOString(),
      category: b.category || b.type || 'General'
    }));
    await offlineDB.broadcasts.bulkPut(formatted);
  } catch (err) {
    console.warn('Failed to cache broadcasts in IndexedDB:', err);
  }
}

export async function getCachedBroadcasts() {
  try {
    return await offlineDB.broadcasts.orderBy('createdAt').reverse().toArray();
  } catch (err) {
    console.warn('Failed to read cached broadcasts:', err);
    return [];
  }
}
