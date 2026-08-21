/**
 * CampusConnect — Central API Client
 * ====================================
 * Single module that every feature component imports to talk to the backend.
 *
 * DESIGN CONTRACT
 * ---------------
 * 1. Role is NEVER read from client state to authorise a request.
 *    The server always resolves role from the JWT. We only use the stored
 *    role to pick the correct URL (e.g. student vs professor grade endpoint).
 *
 * 2. Silent token refresh: when the server returns 401, we attempt one
 *    token refresh via /api/v1/auth/token/refresh and replay the original
 *    request. If the refresh itself fails, we dispatch a "session:expired"
 *    CustomEvent so the AuthProvider can cleanly log out.
 *
 * 3. IDOR safety: URL path IDs (student_id, drive_id, etc.) are never
 *    substituted from client-side user objects alone — callers must
 *    explicitly pass the ID that came back from the server.
 *
 * 4. All request bodies are JSON; all responses are parsed as JSON.
 *    Network-level or non-JSON errors surface as { error: string }.
 *
 * USAGE
 * -----
 *   import api from '@/services/api';          // default export
 *   import { apiGet, apiPost } from '@/services/api'; // named helpers
 *
 *   const grades = await api.academics.getGrades();
 *   const drives = await api.placement.listDrives({ status: 'active' });
 */

// ─────────────────────────────────────────────────────────────────────────────
// 0.  Constants
// ─────────────────────────────────────────────────────────────────────────────

const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

let apiURL = '';
if (isLocal || isVercel) {
  apiURL = '';
} else {
  apiURL = 'https://projectcampusconnect.onrender.com';
}
const BASE = apiURL ? `${apiURL}/api/v1` : '/api/v1';

import { storage } from './storage';

/** localStorage keys (must stay in sync with AuthContext) */
const KEYS = {
  ACCESS:  'access_token',
  REFRESH: 'refresh_token',
  USER:    'ss_user',
};

// ─────────────────────────────────────────────────────────────────────────────
// 1.  Token helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getAccessToken()  { return await storage.get(KEYS.ACCESS)  ?? ''; }
async function getRefreshToken() { return await storage.get(KEYS.REFRESH) ?? ''; }

async function saveTokens({ access_token, refresh_token }) {
  if (access_token)  await storage.set(KEYS.ACCESS,  access_token);
  if (refresh_token) await storage.set(KEYS.REFRESH, refresh_token);
}

async function clearSession() {
  await storage.remove(KEYS.ACCESS);
  await storage.remove(KEYS.REFRESH);
  await storage.remove(KEYS.USER);
  // Also clear legacy keys written by older code
  localStorage.removeItem('token');
  localStorage.removeItem('ss_token');
}

/** Fire a browser-level event so AuthProvider can react without a direct import cycle. */
function notifySessionExpired() {
  window.dispatchEvent(new CustomEvent('session:expired'));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  Core fetch wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single in-flight refresh promise.
 * All concurrent callers await the same promise so only one network
 * request is made and the rotated token is shared — preventing the
 * "second caller uses already-revoked token" logout loop.
 */
let _refreshPromise = null;

/**
 * Low-level fetch with:
 *   - automatic Bearer header injection
 *   - one-shot silent refresh on 401
 *   - JSON parse + error normalisation
 *
 * @param {string} path       – e.g. '/academics/grades'
 * @param {RequestInit} opts  – standard fetch options
 * @param {boolean} _isRetry  – internal flag; prevents refresh loops
 */
async function _request(path, opts = {}, _isRetry = false) {
  const url = BASE + path;
  const token = await getAccessToken();

  const headers = {
    ...(opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(opts.headers ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { ...opts, headers });
  } catch (networkErr) {
    return { error: 'Cannot reach server. Check that the backend is running.', _networkError: true };
  }

  // ── Silent refresh on 401 ─────────────────────────────────────────────────
  if (res.status === 401 && !_isRetry) {
    const refreshed = await _silentRefresh();
    if (refreshed) {
      // Retry original request with the new token
      return _request(path, opts, true);
    }
    // Refresh failed → session is dead.
    // Only notify if there WAS a token — prevents fresh-visit 401s
    // (e.g. unauthenticated endpoint returning 401) from logging the user out.
    if (token) {
      clearSession();
      notifySessionExpired();
    }
    return { error: 'Session expired. Please log in again.', _sessionExpired: true };
  }

  // ── Parse JSON (best-effort) ──────────────────────────────────────────────
  const contentType = res.headers.get('content-type') ?? '';
  let body;
  if (contentType.includes('application/json')) {
    try { body = await res.json(); } catch { body = {}; }
  } else {
    body = {};
  }

  if (!res.ok) {
    // Normalise backend error shapes: { error: "..." } or { message: "..." }
    const msg = body?.error ?? body?.message ?? `HTTP ${res.status}`;
    return { error: msg, status: res.status, _raw: body };
  }

  return body;
}

/**
 * Attempt to exchange the stored refresh token for a new access token.
 *
 * Uses a single shared promise (_refreshPromise) so that if multiple
 * requests race on a 401, they all await the SAME network call instead
 * of each firing their own. This prevents the second caller from trying
 * to use an already-rotated (revoked) refresh token and getting logged out.
 */
async function _silentRefresh() {
  // If a refresh is already in-flight, piggyback on it
  if (_refreshPromise) {
    return _refreshPromise;
  }

  // Read refresh token synchronously before going async so we can bail early
  const rt = await getRefreshToken();
  if (!rt) return false;

  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/token/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      await saveTokens(data);   // saves both access_token + refresh_token
      return true;
    } catch {
      return false;
    } finally {
      // Always clear the shared promise so future refreshes can start fresh
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  Convenience helpers — exported as named exports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1{path}?{params}
 * @param {string} path
 * @param {Record<string,string|number>} [params]
 */
export function apiGet(path, params) {
  const url = params
    ? `${path}?${new URLSearchParams(params).toString()}`
    : path;
  return _request(url, { method: 'GET' });
}

/**
 * POST /api/v1{path} with JSON body
 */
export function apiPost(path, body) {
  return _request(path, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

/**
 * PATCH /api/v1{path} with JSON body
 */
export function apiPatch(path, body) {
  return _request(path, {
    method: 'PATCH',
    body: JSON.stringify(body ?? {}),
  });
}

/**
 * PUT /api/v1{path} with JSON body
 */
export function apiPut(path, body) {
  return _request(path, {
    method: 'PUT',
    body: JSON.stringify(body ?? {}),
  });
}

/**
 * DELETE /api/v1{path}
 */
export function apiDelete(path, body) {
  return _request(path, {
    method: 'DELETE',
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

/**
 * POST multipart/form-data (file uploads).
 * Omits Content-Type so the browser sets the correct boundary.
 */
export function apiUpload(path, formData) {
  return _request(path, {
    method: 'POST',
    headers: {},   // remove Content-Type; _request will still inject Authorization
    body: formData,
  });
}

// Override _request header logic for uploads (formData must not set Content-Type)
// We monkey-patch headers inside _request when body is FormData.
// Re-export _request so advanced callers can use it.
export { _request as apiRaw };

// ─────────────────────────────────────────────────────────────────────────────
// 4.  Domain API objects
// ─────────────────────────────────────────────────────────────────────────────

// ── 4a. Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  /** A6 — login with roll_no or email */
  login: (payload) => apiPost('/auth/login', payload),

  /** A7 — silent refresh (called internally; exposed for manual use) */
  refresh: (refreshToken) =>
    fetch(`${BASE}/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).then((r) => r.json()),

  /** A8 — logout (revokes refresh token server-side) */
  logout: () => apiPost('/auth/logout', {}),

  /** A9 — change own password */
  changePassword: (payload) => apiPost('/auth/password/change', payload),

  /** A1 — send OTP */
  otpSend: (phone) => apiPost('/auth/otp/send', { phone }),

  /** A2 — verify OTP */
  otpVerify: (phone, otp) => apiPost('/auth/otp/verify', { phone, otp }),

  /** A3 — claim student account */
  registerStudent: (payload) => apiPost('/auth/register/student', payload),

  /** A5 — accept admin/tpo/professor invite */
  acceptInvite: (payload) => apiPost('/auth/invite/accept', payload),
};

// ── 4b. Student profile ───────────────────────────────────────────────────────
export const studentsApi = {
  /** S1 — get own profile */
  getMe: () => apiGet('/students/me'),

  /** S2 — update own profile */
  updateMe: (payload) => apiPatch('/students/me', payload),

  /** S3 — list all students (admin / placement_cell only) */
  list: (params) => apiGet('/students', params),

  /** S4 — get any student by ID (IDOR-guarded server-side) */
  getById: (studentId) => apiGet(`/students/${studentId}`),

  /** S5 — admin update student */
  adminUpdate: (studentId, payload) => apiPatch(`/students/${studentId}`, payload),

  /** S6 — admin soft-delete */
  adminDelete: (studentId) => apiDelete(`/students/${studentId}`),

  /** S7 — get student applications (self or admin/tpo) */
  getApplications: (studentId) => apiGet(`/students/${studentId}/applications`),

  /** S8 — get student offers */
  getOffers: (studentId) => apiGet(`/students/${studentId}/offers`),

  /** S9 — role-aware student detail page (returns different field sets per role) */
  getDetail: (studentId) => apiGet(`/students/${studentId}/detail`),

  /** Student self-update extended (home address, parent contact, photo) */
  updateSelf: (payload) => apiPatch('/students/me', payload),
};

// ── 4c. Academics ─────────────────────────────────────────────────────────────
export const academicsApi = {
  /** Student: own grades */
  getGrades: () => apiGet('/academics/grades'),

  /** Student: own attendance */
  getAttendance: () => apiGet('/academics/attendance'),

  /** Student: GPS Geofenced automated check-in */
  geoCheckIn: (payload) => apiPost('/academics/attendance/geocheckin', payload),

  /** Student: Comprehensive analytics, 75% criteria & presence audit logs */
  getStudentAttendanceAnalytics: () => apiGet('/academics/student/attendance/analytics'),

  /** Student / Professor / Admin: timetable (role-scoped server-side) */
  getTimetable: () => apiGet('/academics/timetable'),

  /** Student: assignments visible to them */
  getAssignments: () => apiGet('/academics/assignments'),

  /** Professor / Admin: create a timetable slot */
  saveTimetableSlot: (payload) => apiPost('/academics/timetable/slots', payload),

  /** Professor / Admin: update an existing timetable slot */
  updateTimetableSlot: (slotId, payload) => apiPatch(`/academics/timetable/slots/${slotId}`, payload),

  /** Professor / Admin: soft-delete a timetable slot */
  deleteTimetableSlot: (slotId) => apiDelete(`/academics/timetable/slots/${slotId}`),

  /** Professor / Admin: add extra/makeup class */
  addExtraClass: (payload) => apiPost('/academics/timetable/extra-class', payload),

  /** Professor: get free slots for a course and day */
  getFreeSlots: (params) => apiGet('/academics/timetable/professor/free-slots', params),

  /** Professor: create assignment */
  createAssignment: (payload) => apiPost('/academics/assignments', payload),

  /** Student: submit assignment */
  submitAssignment: (assignmentId, payload) =>
    apiPost(`/academics/assignments/${assignmentId}/submit`, payload),

  /** Professor / Admin: list all submissions for an assignment */
  listSubmissions: (assignmentId) => apiGet(`/academics/assignments/${assignmentId}/submissions`),

  /** Professor / Admin: grade a submission */
  gradeSubmission: (submissionId, payload) =>
    apiPatch(`/academics/submissions/${submissionId}/grade`, payload),

  /** Professor: mark attendance */
  markAttendance: (payload) => apiPost('/academics/attendance/mark', payload),

  /** Professor: get active class session */
  getActiveClass: (params) => apiGet('/academics/roster/active-class', params),

  /** Professor: get roster for a branch/section */
  getRoster: (params) => apiGet('/academics/roster', params),

  /** Student: Fetch comprehensive live attendance analytics, active session & 75% calculator */
  getStudentAttendanceAnalytics: (params) => apiGet('/academics/student/attendance/analytics', params),
  getAttendanceAnalytics: (params) => apiGet('/academics/student/attendance/analytics', params),

  /** Student: Verify GPS geofence and check-in to active class */
  checkInAttendance: (payload) => apiPost('/academics/attendance/check-in', payload),

  /** Student: Fetch chronological immutable attendance audit trail */
  getAttendanceAuditTrail: (params) => apiGet('/academics/attendance/audit-trail', params),
};

// ── 4c-2. Student Delegations & Privileges (CR / CS) ───────────────────────────
export const delegationsApi = {
  /** List active delegations for a batch/section */
  getDelegations: (params) => apiGet('/academics/delegations', params),

  /** Professor / Admin: Grant or update delegation */
  grantDelegation: (payload) => apiPost('/academics/delegations', payload),

  /** Professor / Admin: Revoke delegation */
  revokeDelegation: (delegationId) => apiDelete(`/academics/delegations/${delegationId}`),

  /** Student: Fetch own active delegated privileges */
  getMyPrivileges: () => apiGet('/academics/delegations/me'),
};

// ── 4c-3. Live Session Presence & Dwell Tracker ───────────────────────────────
export const presenceApi = {
  /** Student: Send periodic GPS presence heartbeat ping */
  sendPing: (payload) => apiPost('/academics/attendance/ping', payload),

  /** Student: Record early exit or lecture departure */
  recordLeave: (payload) => apiPost('/academics/attendance/leave', payload),

  /** Professor / Admin: Fetch live session student presence stream */
  getLiveSession: (params) => apiGet('/academics/attendance/live-session', params),
};

// ── 4d. Placement ─────────────────────────────────────────────────────────────
export const placementApi = {
  /** PL1 — list drives (student sees active; tpo sees all) */
  listDrives: (params) => apiGet('/placement/drives', params),

  /** PL2 — create drive (tpo / admin) */
  createDrive: (payload) => apiPost('/placement/drives', payload),

  /** PL3 — get single drive */
  getDrive: (driveId) => apiGet(`/placement/drives/${driveId}`),

  /** PL4 — update drive */
  updateDrive: (driveId, payload) => apiPatch(`/placement/drives/${driveId}`, payload),

  /** PL5 — delete drive */
  deleteDrive: (driveId) => apiDelete(`/placement/drives/${driveId}`),

  /** PL6 — eligible students for a drive (tpo / admin) */
  getEligibleStudents: (driveId) => apiGet(`/placement/drives/${driveId}/eligible`),

  /** PL7 — student applies to drive */
  applyToDrive: (driveId) => apiPost(`/placement/drives/${driveId}/apply`, {}),

  /** PL8 — student withdraws application */
  withdrawApplication: (driveId) => apiDelete(`/placement/drives/${driveId}/apply`),

  /** PL9 — list applications for a drive (tpo / admin) */
  getDriveApplications: (driveId) => apiGet(`/placement/drives/${driveId}/applications`),

  /** PL10 — bulk shortlist students */
  bulkShortlist: (driveId, studentIds) =>
    apiPost(`/placement/drives/${driveId}/shortlist`, { student_ids: studentIds }),

  /** PL11 — update application status */
  updateApplicationStatus: (driveId, applicationId, status) =>
    apiPatch(`/placement/drives/${driveId}/applications/${applicationId}`, { status }),

  /** PL12 — issue offer letter */
  issueOffer: (driveId, payload) => apiPost(`/placement/drives/${driveId}/offers`, payload),

  /** PL13 — list offers for a drive */
  getDriveOffers: (driveId) => apiGet(`/placement/drives/${driveId}/offers`),

  /** PL14 — student accept/decline offer */
  respondToOffer: (offerId, accept) =>
    apiPatch(`/placement/offers/${offerId}`, { accept }),

  /** PL15 — placement stats (tpo / admin) */
  getStats: () => apiGet('/placement/stats'),

  /** PL16 — placement notices */
  getNotices: () => apiGet('/placement/notices'),

  /** PL16 — create notice (tpo / admin) */
  createNotice: (payload) => apiPost('/placement/notices', payload),

  /** PL16 — delete a notice (tpo / admin) */
  deleteNotice: (noticeId) => apiDelete(`/placement/notices/${noticeId}`),

  /** Companies list */
  listCompanies: () => apiGet('/placement/companies'),

  /** Create company */
  createCompany: (payload) => apiPost('/placement/companies', payload),
};

// ── 4e. Community ─────────────────────────────────────────────────────────────
export const communityApi = {
  /** Announcements — visible to all authenticated users */
  getAnnouncements: (params) => apiGet('/community/announcements', params),

  /** Create announcement (admin / professor / placement_cell) */
  createAnnouncement: (payload) => apiPost('/community/announcements', payload),

  /** Delete announcement (admin / professor owns it) */
  deleteAnnouncement: (announcementId) => apiDelete(`/community/announcements/${announcementId}`),

  /** Events */
  getEvents: (params) => apiGet('/community/events', params),
  createEvent: (payload) => apiPost('/community/events', payload),
  updateEvent: (eventId, payload) => apiPatch(`/community/events/${eventId}`, payload),
  deleteEvent: (eventId) => apiDelete(`/community/events/${eventId}`),
  registerForEvent: (eventId) => apiPost(`/community/events/${eventId}/register`, {}),
  unregisterFromEvent: (eventId) => apiDelete(`/community/events/${eventId}/register`),
  getMyEventRegistrations: () => apiGet('/community/events/registrations/me'),

  /** Marketplace */
  getMarketplace: (params) => apiGet('/community/marketplace', params),
  createListing: (payload) => apiPost('/community/marketplace', payload),
  updateListing: (itemId, payload) => apiPatch(`/community/marketplace/${itemId}`, payload),
  deleteListing: (itemId) => apiDelete(`/community/marketplace/${itemId}`),
  markSold: (itemId) => apiPatch(`/community/marketplace/${itemId}`, { status: 'sold' }),

  /** Lost & Found */
  getLostFound: (params) => apiGet('/community/lost-and-found', params),
  reportItem: (payload) => apiPost('/community/lost-and-found', payload),
  updateItem: (itemId, payload) => apiPatch(`/community/lost-and-found/${itemId}`, payload),
  resolveItem: (itemId) => apiPatch(`/community/lost-and-found/${itemId}`, { status: 'resolved' }),
  deleteItem: (itemId) => apiDelete(`/community/lost-and-found/${itemId}`),
};

// ── 4f. E-Library & Notes ─────────────────────────────────────────────────────
export const libraryApi = {
  /** E-Library resources */
  getResources: (params) => apiGet('/community/elibrary', params),
  uploadResource: (payload) => apiPost('/community/elibrary', payload),
  approveResource: (resourceId) => apiPatch(`/community/elibrary/${resourceId}/approve`, {}),
  deleteResource: (resourceId) => apiDelete(`/community/elibrary/${resourceId}`),
  downloadResource: (resourceId) => apiGet(`/community/elibrary/${resourceId}/download`),

  /** Study Notes */
  getNotes: (params) => apiGet('/community/notes', params),
  uploadNote: (payload) => apiPost('/community/notes', payload),
  approveNote: (noteId) => apiPatch(`/community/notes/${noteId}/approve`, {}),
  deleteNote: (noteId) => apiDelete(`/community/notes/${noteId}`),
  downloadNote: (noteId) => apiGet(`/community/notes/${noteId}/download`),
};

// ── 4g. Career ────────────────────────────────────────────────────────────────
export const careerApi = {
  /** Lecture recordings */
  getLectures: () => apiGet('/career/lectures'),
  uploadLecture: (payload) => apiPost('/career/lectures', payload),
  updateSyllabusProgress: (courseCode, subject, progress, branch) =>
    apiPatch('/career/lectures/00000000-0000-0000-0000-000000000000/progress', {
      course_code: courseCode, subject, progress, branch,
    }),

  /** Internships */
  getInternships: (params) => apiGet('/career/internships', params),
  applyInternship: (driveId) => apiPost(`/career/internships/${driveId}/apply`, {}),

  /** Mock interviews */
  getMockInterviews: () => apiGet('/career/mock-interviews'),
  bookMockInterview: (sessionId) => apiPost(`/career/mock-interviews/${sessionId}/book`, {}),
  getMyMockBookings: () => apiGet('/career/mock-interviews/me'),
  submitMockFeedback: (bookingId, payload) => apiPost(`/career/mock-interviews/${bookingId}/feedback`, payload),
  approveMockSession: (sessionId, payload) => apiPatch(`/career/mock-interviews/${sessionId}/approve`, payload),

  /** Mentorship */
  getMentors: () => apiGet('/career/mentors'),
  requestMentorship: (mentorId, payload) =>
    apiPost(`/career/mentors/${mentorId}/request`, payload),
  getMentorRequests: () => apiGet('/career/mentors/requests'),
  respondToMentorshipRequest: (requestId, action) =>
    apiPatch(`/career/mentors/requests/${requestId}`, { action }),
  completeMentorshipSession: (requestId, payload) =>
    apiPost(`/career/mentors/requests/${requestId}/complete`, payload),

  /** Resume builder — profile data + versioning */
  getResumeData: () => apiGet('/students/me'),
  saveResume: (payload) => apiPost('/students/me/resume', payload),
  listResumeVersions: () => apiGet('/students/me/resume'),
  getResumeVersion: (version) => apiGet(`/students/me/resume/${version}`),
  getResumeSuggestions: () => apiGet('/students/me/resume/suggestions'),
};

// ── 4h. Chats ─────────────────────────────────────────────────────────────────
export const chatsApi = {
  /** List all conversations the current user belongs to */
  getConversations: () => apiGet('/career/chats'),

  /** List all contacts (students + professors) */
  getContacts: () => apiGet('/career/chats/contacts'),

  /** Create DM or group */
  createConversation: (payload) => apiPost('/career/chats/create', payload),

  /** Messages in a conversation */
  getMessages: (conversationId) => apiGet(`/career/chats/${conversationId}/messages`),

  /** Send a message */
  sendMessage: (conversationId, content) =>
    apiPost(`/career/chats/${conversationId}/messages/send`, { content }),

  /** Leave a group */
  leaveGroup: (conversationId) =>
    apiPost('/career/chats/leave', { conversation_id: conversationId }),

  /** Join a group */
  joinGroup: (conversationId) =>
    apiPost('/career/chats/join', { conversation_id: conversationId }),

  /** Accept a DM request (admin/TPO accepting a student request) */
  acceptDmRequest: (conversationId) =>
    apiPost(`/career/chats/${conversationId}/accept`, {}),

  /** Respond to a group invite (student: accept or decline) */
  respondToInvite: (conversationId, action) =>
    apiPost(`/career/chats/${conversationId}/invite/respond`, { action }),

  /** Member management */
  addMember: (conversationId, userId) =>
    apiPost('/career/chats/members/add', { conversation_id: conversationId, user_id: userId }),
  removeMember: (conversationId, userId) =>
    apiPost('/career/chats/members/remove', { conversation_id: conversationId, user_id: userId }),
  promoteMember: (conversationId, userId) =>
    apiPost('/career/chats/members/promote', { conversation_id: conversationId, user_id: userId }),
};

// ── 4i. Admin ─────────────────────────────────────────────────────────────────
export const adminApi = {
  /** Dashboard summary */
  getSummary: () => apiGet('/admin/summary'),

  /** User management */
  listUsers: (params) => apiGet('/admin/users', params),
  getUserById: (userId) => apiGet(`/admin/users/${userId}`),
  updateUser: (userId, payload) => apiPatch(`/admin/users/${userId}`, payload),
  toggleUserActive: (userId, isActive) =>
    apiPatch(`/admin/users/${userId}`, { is_active: isActive }),
  deleteUser: (userId) => apiDelete(`/admin/users/${userId}`),

  /** Bulk student import */
  bulkImportStudents: (formData) => apiUpload('/admin/students/import-csv', formData),

  /** Manual user creation */
  createUserManually: (payload) => apiPost('/admin/users', payload),

  /** Invite tokens */
  createInvite: (payload) => apiPost('/admin/invites', payload),
  listInvites: () => apiGet('/admin/invites'),

  /** Audit log */
  getAuditLog: (params) => apiGet('/admin/audit-logs', params),

  /** Analytics */
  getAnalytics: () => apiGet('/admin/analytics/placement'),
  getProfileAnalytics: () => apiGet('/admin/analytics/profiles'),

  /** Branch comparison */
  getBranchStats: () => apiGet('/admin/analytics/placement'),

  /** Data health */
  getDataHealth: () => apiGet('/admin/data-health'),

  /** Rules engine */
  getRules: () => apiGet('/admin/rules'),
  saveRule: (payload) => apiPost('/admin/rules', payload),
  deleteRule: (ruleId) => apiDelete(`/admin/rules/${ruleId}`),

  /** Announcements (admin tier) */
  getAnnouncements: (params) => apiGet('/admin/announcements', params),
  createAnnouncement: (payload) => apiPost('/admin/announcements', payload),

  // Control Panel Approvals
  getPendingApprovals: () => apiGet('/admin/pending-approvals'),
  approveTpo: (userId) => apiPost(`/admin/tpo/approve/${userId}`),
  rejectTpo: (userId) => apiPost(`/admin/tpo/reject/${userId}`),
  approveFaculty: (profId) => apiPost(`/admin/faculty/approve/${profId}`),
  rejectFaculty: (profId) => apiPost(`/admin/faculty/reject/${profId}`),

  // Detail Access Requests
  getDetailRequests: () => apiGet('/admin/detail-requests'),
  approveDetailRequest: (reqId) => apiPost(`/admin/detail-requests/${reqId}/approve`),
  rejectDetailRequest: (reqId) => apiPost(`/admin/detail-requests/${reqId}/reject`),

  // TPO Booking Approvals
  getTimetableBookings: () => apiGet('/admin/timetable-bookings'),
  approveTimetableBooking: (bookingId) => apiPost(`/admin/timetable-bookings/${bookingId}/approve`),
  rejectTimetableBooking: (bookingId) => apiPost(`/admin/timetable-bookings/${bookingId}/reject`),

  // Moderation Reports Actions
  resolveReport: (reportId) => apiPost(`/admin/reports/${reportId}/resolve`),
  dismissReport: (reportId) => apiPost(`/admin/reports/${reportId}/dismiss`),

  // Merchandise Store
  createMerchandise: (payload) => apiPost('/admin/merchandise', payload),
  getMerchandise: () => apiGet('/admin/merchandise'),
  purchaseMerchandise: (payload) => apiPost('/admin/merchandise/purchase', payload),
  getMerchandiseOrders: () => apiGet('/admin/merchandise/orders'),
  updateMerchandiseOrder: (orderId, payload) => apiPatch(`/admin/merchandise/orders/${orderId}`, payload),

  // Pending Events Approvals & Allotment
  getPendingEvents: () => apiGet('/admin/events/pending'),
  approveEvent: (eventId) => apiPost(`/admin/events/${eventId}/approve`),
  rejectEvent: (eventId) => apiPost(`/admin/events/${eventId}/reject`),
  getEventRegistrations: (eventId) => apiGet(`/admin/events/${eventId}/registrations`),
  allotEventTicket: (eventId, payload) => apiPost(`/admin/events/${eventId}/allot-ticket`, payload),

  // Master Timetable Slot CRUD
  createTimetableSlot: (payload) => apiPost('/academics/timetable/slots', payload),
  updateTimetableSlot: (slotId, payload) => apiPatch(`/academics/timetable/slots/${slotId}`, payload),
  deleteTimetableSlot: (slotId) => apiDelete(`/academics/timetable/slots/${slotId}`),

  // Professor Attendance Check-ins
  getProfessorAttendance: () => apiGet('/admin/attendance/professors'),
  markProfessorCheckin: (payload) => apiPost('/admin/attendance/professors/check-in', payload),

  // Branch management
  listBranches: (params) => apiGet('/admin/branches', params),
  createBranch: (payload) => apiPost('/admin/branches', payload),
  updateBranch: (branchId, payload) => apiPatch(`/admin/branches/${branchId}`, payload),
  deactivateBranch: (branchId) => apiPatch(`/admin/branches/${branchId}/deactivate`, {}),
  activateBranch: (branchId) => apiPatch(`/admin/branches/${branchId}/activate`, {}),

  // Professor Class Assignments
  listProfessorAssignments: (params) => apiGet('/admin/professor-assignments', params),
  createProfessorAssignment: (payload) => apiPost('/admin/professor-assignments', payload),
  updateProfessorAssignment: (id, payload) => apiPatch(`/admin/professor-assignments/${id}`, payload),
  deactivateProfessorAssignment: (id) => apiDelete(`/admin/professor-assignments/${id}`),
};

// ── 4j. Professors ────────────────────────────────────────────────────────────
export const professorsApi = {
  getMe: () => apiGet('/professors/me'),
  updateMe: (payload) => apiPatch('/professors/me', payload),
  getMyClasses: () => apiGet('/professors/me/classes'),
  list: (params) => apiGet('/professors', params),
  getById: (profId) => apiGet(`/professors/${profId}`),
};

// ── 4k. Notifications ─────────────────────────────────────────────────────────
export const notificationsApi = {
  /** Paginated list of the current user's notifications */
  list: (params) => apiGet('/notifications', params),

  /** Mark one notification read */
  markRead: (notificationId) => apiPatch(`/notifications/${notificationId}/read`, {}),

  /** Mark all read */
  markAllRead: () => apiPost('/notifications/mark-all-read', {}),

  /** Unread count (for bell icon badge) */
  unreadCount: () => apiGet('/notifications/unread-count'),
};

// ── 4k. AI Copilot ────────────────────────────────────────────────────────────
export const copilotApi = {
  /** Send message to AI Copilot assistant */
  chat: (messages, context = {}) => apiPost('/ai/copilot/chat', { messages, context }),
};

// ─────────────────────────────────────────────────────────────────────────────
// 5.  Default export — grouped namespace
// ─────────────────────────────────────────────────────────────────────────────

const api = {
  auth:          authApi,
  students:      studentsApi,
  academics:     academicsApi,
  placement:     placementApi,
  community:     communityApi,
  library:       libraryApi,
  career:        careerApi,
  chats:         chatsApi,
  admin:         adminApi,
  professors:    professorsApi,
  notifications: notificationsApi,
  copilot:       copilotApi,

  // Re-expose low-level helpers for edge cases
  get:    apiGet,
  post:   apiPost,
  patch:  apiPatch,
  put:    apiPut,
  delete: apiDelete,
  upload: apiUpload,
};

export default api;
