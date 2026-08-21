/**
 * Role-Scoped Tool Definitions & Capability Matrix for Campus Copilot
 * ===================================================================
 * Defines tools, schemas, personas, and quick actions for:
 * 1. Student ("Learner League")
 * 2. Professor ("Faculty League")
 * 3. TPO - Training & Placement Officer ("Placement League")
 * 4. Admin ("System League")
 */

export const ROLE_LEAGUES = {
  STUDENT: {
    id: 'STUDENT',
    leagueName: 'Learner League',
    badge: '🎓 Learner League',
    color: '#8b5cf6',
    systemPrompt: `You are Campus Copilot for Students (Learner League). Your mission is to provide personalized, encouraging, and accurate academic guidance. You have access to personal attendance statistics, timetable/schedule, enrolled assignments, and batch broadcasts. Never reveal administrative system logs or other students' private attendance records.`,
    quickActions: [
      { label: 'My Attendance %', icon: '📊', prompt: 'What is my current attendance percentage and safe bunk margin?' },
      { label: "Today's Timetable", icon: '📅', prompt: "Show me today's class timetable and room allocations." },
      { label: 'Pending Assignments', icon: '📝', prompt: 'Do I have any pending assignments or lab submissions due?' },
      { label: 'Batch Notices', icon: '📢', prompt: 'Summarize the latest official campus notices and announcements.' },
      { label: 'Who is our CR?', icon: '👑', prompt: 'Who is the active Class Representative (CR) for my batch?' },
      { label: "Dijkstra's Code", icon: '💻', prompt: "Explain Dijkstra's shortest path algorithm with Python code." },
      { label: 'GATE Syllabus', icon: '🎓', prompt: 'Give an overview of the GATE Computer Science exam pattern and core subjects.' },
    ],
    tools: [
      {
        name: 'getMyAttendanceStats',
        description: 'Retrieves personal subject-wise and overall attendance percentage, attended counts, safe bunk margins, and exam eligibility warning flags.',
        parameters: {
          type: 'object',
          properties: {
            subject_code: { type: 'string', description: 'Optional subject code e.g. CS401' },
          },
        },
      },
      {
        name: 'getMySchedule',
        description: 'Fetches personal daily lecture timetable, classroom numbers, faculty names, and timing windows.',
        parameters: {
          type: 'object',
          properties: {
            day: { type: 'string', description: 'Day of week e.g. Monday, today' },
          },
        },
      },
      {
        name: 'getBatchBroadcasts',
        description: 'Lists official announcements and circulars published for the enrolled branch/semester.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Optional filter e.g. Academic, Events, Exams' },
          },
        },
      },
      {
        name: 'searchAcademicWeb',
        description: 'Searches academic topics, coding concepts, data structures, algorithms, and GATE preparation material.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search term or question' },
          },
          required: ['query'],
        },
      },
    ],
  },

  PROFESSOR: {
    id: 'PROFESSOR',
    leagueName: 'Faculty League',
    badge: '👨‍🏫 Faculty League',
    color: '#0ea5e9',
    systemPrompt: `You are Campus Copilot for Faculty (Faculty League). You assist professors with real-time live lecture presence tracking, batch attendance analytics, defaulter identification (<75%), and drafting class broadcasts. Keep communications professional, concise, and academically rigorous.`,
    quickActions: [
      { label: 'Live Lecture Presence', icon: '📡', prompt: 'Show live presence stream and active student headcount in my ongoing lecture.' },
      { label: 'Defaulter List (<75%)', icon: '⚠️', prompt: 'List students with critical attendance shortage below 75% in my subjects.' },
      { label: 'Class Attendance Overview', icon: '📊', prompt: 'Provide a batch-wide attendance overview and distribution for my courses.' },
      { label: 'Draft Announcement', icon: '📢', prompt: 'Help me draft a class broadcast about the upcoming lab submission deadline.' },
      { label: 'My Teaching Schedule', icon: '📅', prompt: 'Show my assigned lecture timetable and room allocations today.' },
    ],
    tools: [
      {
        name: 'getLiveLecturePresence',
        description: 'Retrieves real-time student entry/exit logs, active dwell metrics, and headcounts for the professor ongoing or recent lecture.',
        parameters: {
          type: 'object',
          properties: {
            room: { type: 'string', description: 'Classroom identifier e.g. Room 302' },
          },
        },
      },
      {
        name: 'getBatchAttendanceOverview',
        description: 'Queries class-wide attendance distribution, identifies defaulters below the 75% threshold, and checks exam eligibility.',
        parameters: {
          type: 'object',
          properties: {
            subject_code: { type: 'string', description: 'Course code e.g. CS401' },
            threshold: { type: 'number', description: 'Attendance threshold % (default 75)' },
          },
        },
      },
      {
        name: 'draftClassAnnouncement',
        description: 'Creates a draft broadcast targeted to assigned subject batches with title and category.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Announcement title' },
            content: { type: 'string', description: 'Message content' },
            batch: { type: 'string', description: 'Target batch e.g. CSE-A' },
          },
          required: ['title', 'content'],
        },
      },
      {
        name: 'searchAcademicWeb',
        description: 'Searches for academic reference materials, lecture notes, textbook references, and research questions.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search term' },
          },
          required: ['query'],
        },
      },
    ],
  },

  TPO: {
    id: 'TPO',
    leagueName: 'Placement League',
    badge: '💼 Placement League',
    color: '#10b981',
    systemPrompt: `You are Campus Copilot for Training & Placement Officers (Placement League). You assist with placement drives, CTC packages, applicant shortlists, and eligibility filtering by CGPA, backlogs, and attendance. Keep insights structured with actionable drive summaries.`,
    quickActions: [
      { label: 'Drive Overview', icon: '💼', prompt: 'Summarize active placement drives, visiting companies, and CTC packages.' },
      { label: 'Eligible Students (≥7.5)', icon: '🎯', prompt: 'Filter eligible students for tech drives with CGPA >= 7.5 and no backlogs.' },
      { label: 'Draft Drive Notice', icon: '📢', prompt: 'Draft an urgent notice for upcoming Google and Microsoft campus drives.' },
      { label: 'Hiring Trends 2026', icon: '📈', prompt: 'What are the key tech hiring trends and skills in demand for 2026 college grads?' },
    ],
    tools: [
      {
        name: 'getPlacementDriveStats',
        description: 'Retrieves active and upcoming placement drives, registered student counts, shortlists, and interview schedules.',
        parameters: {
          type: 'object',
          properties: {
            company: { type: 'string', description: 'Optional company name filter' },
          },
        },
      },
      {
        name: 'filterEligibleStudents',
        description: 'Queries students meeting specific placement criteria including minimum CGPA, branch, backlogs, and attendance.',
        parameters: {
          type: 'object',
          properties: {
            min_cgpa: { type: 'number', description: 'Minimum CGPA required' },
            branch: { type: 'string', description: 'Branch filter e.g. CSE, IT, ECE' },
            max_backlogs: { type: 'number', description: 'Max allowed active backlogs' },
          },
        },
      },
      {
        name: 'draftPlacementNotice',
        description: 'Generates and posts placement-specific alerts, job descriptions, and drive deadline updates.',
        parameters: {
          type: 'object',
          properties: {
            company: { type: 'string', description: 'Company name' },
            role: { type: 'string', description: 'Job role' },
            ctc: { type: 'string', description: 'CTC package e.g. 24 LPA' },
            deadline: { type: 'string', description: 'Application deadline' },
          },
          required: ['company', 'role'],
        },
      },
      {
        name: 'searchIndustryWeb',
        description: 'Searches industry hiring trends, company interview patterns, compensation benchmarks, and technical assessments.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Company or industry query' },
          },
          required: ['query'],
        },
      },
    ],
  },

  ADMIN: {
    id: 'ADMIN',
    leagueName: 'System League',
    badge: '🛡️ System League',
    color: '#f59e0b',
    systemPrompt: `You are Campus Copilot for University Administrators (System League). You possess high-level platform oversight across system health, user directories, role delegations, and security audit logs. Emphasize compliance, stability, and administrative efficiency.`,
    quickActions: [
      { label: 'System Health', icon: '🛡️', prompt: 'Summarize system health, active user counts, and database status.' },
      { label: 'User Directory', icon: '👥', prompt: 'Search and inspect user accounts across student, faculty, and staff directories.' },
      { label: 'Recent Audit Logs', icon: '📜', prompt: 'Show recent security audit logs, role modifications, and admin actions.' },
      { label: 'Branch & College Stats', icon: '🏛️', prompt: 'Summarize active departments, branches, and semester enrollments.' },
    ],
    tools: [
      {
        name: 'getSystemHealthOverview',
        description: 'Summarizes overall active user counts, total attendance records, scheduled lectures, and API uptime.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'queryUserDirectory',
        description: 'Searches and verifies user accounts across students, faculty, and administrative staff by name, email, roll number, or role.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search term e.g. Anoop, CSE, Professor' },
            role: { type: 'string', description: 'Optional role filter e.g. student, professor, admin' },
          },
        },
      },
      {
        name: 'getAuditLogs',
        description: 'Inspects critical system actions, permission updates, and administrative events with timestamps.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of logs to retrieve (default 10)' },
          },
        },
      },
      {
        name: 'searchGeneralWeb',
        description: 'Unrestricted web search for academic accreditation guidelines, UGC/AICTE norms, and university management best practices.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
    ],
  },
};

/**
 * Returns the capability league configuration matching the user role.
 */
export function getRoleLeague(role = 'STUDENT') {
  const normRole = (role || 'STUDENT').toUpperCase();
  if (normRole.includes('PROF') || normRole.includes('FACULTY')) return ROLE_LEAGUES.PROFESSOR;
  if (normRole.includes('TPO') || normRole.includes('PLACEMENT')) return ROLE_LEAGUES.TPO;
  if (normRole.includes('ADMIN')) return ROLE_LEAGUES.ADMIN;
  return ROLE_LEAGUES.STUDENT;
}
