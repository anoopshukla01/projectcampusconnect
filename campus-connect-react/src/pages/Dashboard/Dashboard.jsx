import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import './Dashboard.css';

function LiveBadge({ time }) {
  const [status, setStatus] = useState('');

  const update = useCallback(() => {
    const now  = new Date();
    const nowM = now.getHours() * 60 + now.getMinutes();
    const [start] = time.split(' - ');
    const [h, m] = start.split(':').map(Number);
    const cls  = h * 60 + m;
    const diff = cls - nowM;

    if (diff > 0 && diff <= 60) setStatus(`Live in ${diff}m`);
    else if (diff <= 0 && diff > -90) setStatus('Live now');
    else setStatus('');
  }, [time]);

  useEffect(() => {
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [update]);

  if (!status) return null;
  return <span className="live-badge">{status}</span>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const showToast = useToast();
  const [reminderDone, setReminderDone] = useState(false);

  // Student specific API data
  const { data: studentProfile, loading: profileLoading } = useApiData(
    user?.role !== 'professor' ? '/students/me' : null,
    null
  );

  // Live announcements from backend
  const { data: annData } = useApiData('/community/announcements', { announcements: [] });
  const announcements = useMemo(() => (annData?.announcements || []).slice(0, 5), [annData]);

  const isProf = user?.role === 'professor';

  function go(path) {
    showToast('Opening…', 'info', 800);
    setTimeout(() => navigate(path), 300);
  }

  // Calculate totals
  const totalStudents = useMemo(() => {
    if (!isProf) return 0;
    return (user.classes || []).reduce((sum, c) => sum + c.students, 0);
  }, [user, isProf]);

  if (isProf) {
    return (
      <>
        {/* Welcome */}
        <div className="welcome-block">
          <div>
            <p className="welcome-greeting">Welcome back, {user.name} 👋</p>
            <h1 className="welcome-title">Manage your classes and students</h1>
            <p className="welcome-meta">{user.designation} &nbsp;·&nbsp; Department of {user.department}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row" role="list" aria-label="Professor statistics">
          <div className="stat-card" role="listitem">
            <span className="stat-label">Active Classes</span>
            <span className="stat-value">{user.classes?.length || 0}</span>
            <span className="stat-delta positive">Teaching this term</span>
          </div>
          <div className="stat-card" role="listitem">
            <span className="stat-label">Total Students</span>
            <span className="stat-value">{totalStudents}</span>
            <span className="stat-delta neutral">Enrolled across all courses</span>
          </div>
          <div className="stat-card" role="listitem">
            <span className="stat-label">Pending Grading</span>
            <span className="stat-value">14</span>
            <span className="stat-delta warning">Assignments to evaluate</span>
          </div>
          <div className="stat-card" role="listitem">
            <span className="stat-label">Mentorship Requests</span>
            <span className="stat-value">{user.mentorshipRequests?.length || 0}</span>
            <span className="stat-delta positive">Awaiting approval</span>
          </div>
        </div>

        {/* Mid Row: Today's Lectures + Roster Quick Links */}
        <div className="mid-row">
          <section className="panel schedule-panel" aria-labelledby="scheduleTitle">
            <div className="panel-header">
              <h2 className="panel-title" id="scheduleTitle">Today's Schedule</h2>
              <button className="panel-link" onClick={() => go('/timetable')}>Full week</button>
            </div>
            <ul className="schedule-list" role="list">
              {user.schedule && user.schedule.length ? user.schedule.map((cls, i) => (
                <li className="schedule-item" key={i}>
                  <span className="schedule-time">{cls.time}</span>
                  <div className="schedule-body">
                    <div className="schedule-name-row">
                      <span className="schedule-name">{cls.name}</span>
                      <LiveBadge time={cls.time} />
                    </div>
                    <span className="schedule-meta">{cls.code} · {cls.room} · Room A</span>
                  </div>
                </li>
              )) : (
                <li style={{ color: 'var(--clr-muted)', fontSize: '0.825rem', padding: '0.5rem 0' }}>
                  No classes scheduled for today.
                </li>
              )}
            </ul>
          </section>

          <section className="panel insight-panel" aria-labelledby="quickActionsTitle">
            <h2 className="panel-title" id="quickActionsTitle" style={{ marginBottom: '1rem' }}>⚡ Professor Actions</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button className="action-btn" style={{ fontSize: '0.8rem', padding: '0.75rem' }} onClick={() => go('/assignments')}>Grade Assignments</button>
              <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.75rem' }} onClick={() => go('/attendance')}>Mark Attendance</button>
              <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.75rem' }} onClick={() => go('/announcements')}>Post Notice</button>
              <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.75rem' }} onClick={() => go('/roster')}>View Roster</button>
            </div>
          </section>
        </div>

        {/* Bottom Row */}
        <div className="bottom-row">
          <section className="panel assignments-panel" aria-labelledby="mentorshipTitle">
            <div className="panel-header">
              <h2 className="panel-title" id="mentorshipTitle">Mentorship Requests</h2>
              <button className="panel-link" onClick={() => go('/mentorship')}>View all</button>
            </div>
            <ul className="assign-list" role="list">
              {user.mentorshipRequests?.map(req => (
                <li className="assign-item" key={req.id}>
                  <div className="assign-icon" aria-hidden="true" style={{ background: 'var(--clr-primary-soft)', color: 'var(--clr-primary)' }}>🎓</div>
                  <div className="assign-body">
                    <span className="assign-name">{req.studentName}</span>
                    <span className="assign-subject">{req.topic}</span>
                  </div>
                  <span className="status-pill warning" style={{ cursor: 'pointer' }} onClick={() => go('/mentorship')}>Pending</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel announcements-panel" aria-labelledby="announceTitle">
            <div className="panel-header">
              <h2 className="panel-title" id="announceTitle">Recent Announcements</h2>
              <button className="panel-link" onClick={() => go('/announcements')}>Full feed</button>
            </div>
            <ul className="announce-list" role="list">
              {announcements.slice(0, 3).map((a, i) => (
                <li className="announce-item" key={i}>
                  <div className="announce-dot" style={{ background: '#3b82f6' }} aria-hidden="true" />
                  <div className="announce-body">
                    <span className="announce-title">{a.title}</span>
                    <span className="announce-meta">{a.source} &nbsp;·&nbsp; {a.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </>
    );
  }

  // Student Dashboard
  const quickActions = [
    { path: '/chats',       icon: 'chat',   label: 'Messages',         sub: 'Chat with faculty & peers', iconSvg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { path: '/internships', icon: 'intern', label: 'Explore Drives',   sub: 'View placement drives',      iconSvg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> },
    { path: '/mentorship',  icon: 'mentor', label: 'Book a Mentor',    sub: 'Faculty guidance',           iconSvg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  ];

  const isEnrolled = Boolean(studentProfile?.branch || studentProfile?.cgpa);
  const displayName = studentProfile?.full_name || user?.name || 'Student';

  return (
    <>
      {/* Welcome */}
      <div className="welcome-block">
        <div>
          <p className="welcome-greeting">Welcome back, {displayName} 👋</p>
          <h1 className="welcome-title">Your campus, one calm view</h1>
          <p className="welcome-meta">
            {isEnrolled ? (
              `${studentProfile.branch} · Semester ${studentProfile.semester || 1} · Roll ${studentProfile.roll_no}`
            ) : (
              `Account Status: Registered · Department Enrollment Pending`
            )}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row" role="list" aria-label="Academic statistics">
        <div className="stat-card" role="listitem">
          <span className="stat-label">Overall CGPA</span>
          <span className="stat-value">{profileLoading ? '...' : (studentProfile?.cgpa || '--')}</span>
          <span className="stat-delta neutral">Cumulative GPA</span>
        </div>
        <div className="stat-card" role="listitem">
          <span className="stat-label">Attendance</span>
          <span className="stat-value">
            {profileLoading ? '...' : (studentProfile?.attendance_pct !== null && studentProfile?.attendance_pct !== undefined ? `${studentProfile.attendance_pct}%` : '--')}
          </span>
          <span className="stat-delta neutral">Min. required 75%</span>
        </div>
        <div className="stat-card" role="listitem">
          <span className="stat-label">Pending tasks</span>
          <span className="stat-value">{user.pendingTasks ?? 0}</span>
          <span className="stat-delta warning">{user.tasksDelta || '0 due this week'}</span>
        </div>
        <div className="stat-card" role="listitem">
          <span className="stat-label">Class rank</span>
          <span className="stat-value">{user.classRank || '--'}</span>
          <span className="stat-delta neutral">Rank in division</span>
        </div>
      </div>

      {/* Mid Row: Schedule + Insight */}
      <div className="mid-row">
        <section className="panel schedule-panel" aria-labelledby="scheduleTitle">
          <div className="panel-header">
            <h2 className="panel-title" id="scheduleTitle">Today's schedule</h2>
            <button className="panel-link" onClick={() => go('/timetable')}>Full week</button>
          </div>
          <ul className="schedule-list" id="scheduleList" role="list">
            {user.schedule && user.schedule.length ? user.schedule.map((cls, i) => (
              <li className="schedule-item" key={i}>
                <span className="schedule-time">{cls.time}</span>
                <div className="schedule-body">
                  <div className="schedule-name-row">
                    <span className="schedule-name">{cls.name}</span>
                    <LiveBadge time={cls.time} />
                  </div>
                  <span className="schedule-meta">{cls.code} · {cls.room} · {cls.prof}</span>
                </div>
              </li>
            )) : (
              <li style={{ color: 'var(--clr-muted)', fontSize: '0.875rem', padding: '1rem 0', textAlign: 'center' }}>
                No active classes scheduled for your account today.
              </li>
            )}
          </ul>
        </section>

        <section className="panel insight-panel" aria-labelledby="insightTitle">
          <div className="insight-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="insight-eyebrow">Smart insight</span>
          </div>
          {isEnrolled && user?.attendance ? (
            <>
              <h3 className="insight-title" id="insightTitle">Attendance Tracking Active</h3>
              <p className="insight-body">Your overall attendance is currently at {user.attendance}. Maintain above 75% for exam eligibility.</p>
            </>
          ) : (
            <>
              <h3 className="insight-title" id="insightTitle">Welcome to Campus Connect!</h3>
              <p className="insight-body">Your course timetable, attendance logs, and gradebook will update automatically once assigned to your academic department roster.</p>
            </>
          )}
          <button
            className="btn-insight"
            id="reminderBtn"
            disabled={reminderDone}
            style={reminderDone ? { background: '#16a34a' } : {}}
            onClick={() => {
              setReminderDone(true);
              showToast("Smart reminders enabled! You'll be notified before scheduled events.", 'success', 3500);
              setTimeout(() => setReminderDone(false), 3000);
            }}
          >
            {reminderDone ? 'Reminders enabled ✓' : 'Enable smart reminders'}
          </button>
        </section>
      </div>

      {/* Bottom Row 1: Assignments + Announcements */}
      <div className="bottom-row">
        <section className="panel assignments-panel" aria-labelledby="assignTitle">
          <div className="panel-header">
            <h2 className="panel-title" id="assignTitle">Upcoming assignments</h2>
            <button className="panel-link" onClick={() => go('/assignments')}>View all</button>
          </div>
          <ul className="assign-list" id="assignList" role="list">
            {user.assignments && user.assignments.length ? user.assignments.map((a, i) => (
              <li className="assign-item" key={i}>
                <div className={`assign-icon${a.download ? ' download' : ''}`} aria-hidden="true">
                  {a.download ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  )}
                </div>
                <div className="assign-body">
                  <span className="assign-name">{a.name}</span>
                  <span className="assign-subject">{a.subject}</span>
                </div>
                <span className="assign-due">{a.due}</span>
              </li>
            )) : (
              <li style={{ color: 'var(--clr-muted)', fontSize: '0.825rem', padding: '0.5rem 0' }}>
                No pending assignments. Well done!
              </li>
            )}
          </ul>
        </section>

        <section className="panel announcements-panel" aria-labelledby="announceTitle">
          <div className="panel-header">
            <h2 className="panel-title" id="announceTitle">Announcements</h2>
            <span className="badge-new">{announcements?.length || 0} new</span>
          </div>
          <ul className="announce-list" id="announceList" role="list">
            {announcements.slice(0, 3).map((a, i) => (
              <li className="announce-item" key={i}>
                <div className="announce-dot" style={{ background: '#3b82f6' }} aria-hidden="true" />
                <div className="announce-body">
                  <span className="announce-title">{a.title}</span>
                  <span className="announce-meta">{a.source} &nbsp;·&nbsp; {a.time}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Bottom Row 2: Events + Quick Actions */}
      <div className="bottom-row">
        <section className="panel events-panel" aria-labelledby="eventsTitle">
          <div className="panel-header">
            <h2 className="panel-title" id="eventsTitle">Happening on campus</h2>
            <button className="panel-link" onClick={() => go('/events')}>Browse</button>
          </div>
          <div className="event-cards">
            <div className="event-card">
              <span className="event-tag hackathon">Hackathon</span>
              <p className="event-name">Hyperion 4.0</p>
              <p className="event-meta">Dec 5 · 5:00 PM</p>
              <p className="event-venue">Innovation hub</p>
            </div>
            <div className="event-card">
              <span className="event-tag talk">Talk</span>
              <p className="event-name">Google tech talk</p>
              <p className="event-meta">Dec 5 · 5:00 PM</p>
              <p className="event-venue">Main auditorium</p>
            </div>
          </div>
        </section>

        <section className="panel quick-panel" aria-labelledby="quickTitle">
          <h2 className="panel-title" id="quickTitle">Quick actions</h2>
          <ul className="quick-list" role="list">
            {quickActions.map(q => (
              <li key={q.path}>
                <button className="quick-item" onClick={() => go(q.path)}>
                  <div className={`quick-icon ${q.icon}`} aria-hidden="true">{q.iconSvg}</div>
                  <div className="quick-body">
                    <span className="quick-label">{q.label}</span>
                    <span className="quick-sub">{q.sub}</span>
                  </div>
                  <svg className="quick-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
