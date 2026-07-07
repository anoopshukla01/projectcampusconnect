/**
 * StudentSphere – Student Dashboard Logic
 * File: student.js
 */

(function () {
  'use strict';

  // 1. Initialize Common portal systems (auth, nav, topbar, mobile menu, search)
  // StudentSphere is loaded from studentCommon.js
  if (!window.StudentSphere || !window.StudentSphere.user) {
    return; // Auth guard already redirected
  }

  var user = window.StudentSphere.user;
  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('dashboard');

  /* ═══════════════════════════════════════════════════════════
     2. POPULATE MAIN DASHBOARD COMPONENT DATA
  ═══════════════════════════════════════════════════════════ */

  /* ── 2a. Welcome greeting ─────────────────────────────── */
  var welcomeGreeting = document.getElementById('welcomeGreeting');
  if (welcomeGreeting) {
    welcomeGreeting.textContent = 'Welcome back, ' + user.name + ' \uD83D\uDC4B';
  }

  /* ── 2b. Stats cards ────────────────────────── */
  var statCgpa          = document.getElementById('statCgpa');
  var statCgpaDelta     = document.getElementById('statCgpaDelta');
  var statAttendance    = document.getElementById('statAttendance');
  var statTasks         = document.getElementById('statTasks');
  var statTasksDelta    = document.getElementById('statTasksDelta');
  var statRank          = document.getElementById('statRank');
  var statTotalStudents = document.getElementById('statTotalStudents');

  if (statCgpa)          statCgpa.textContent          = user.cgpa;
  if (statCgpaDelta) {
    statCgpaDelta.textContent  = user.cgpaDelta;
    statCgpaDelta.className    = 'stat-delta ' + (user.cgpaDeltaClass || 'positive');
  }
  if (statAttendance)    statAttendance.textContent    = user.attendance;
  if (statTasks)         statTasks.textContent         = user.pendingTasks;
  if (statTasksDelta)    statTasksDelta.textContent    = user.tasksDelta;
  if (statRank)          statRank.textContent          = user.classRank;
  if (statTotalStudents) statTotalStudents.textContent = 'of ' + user.totalStudents + ' students';

  /* ── 2c. Today's Schedule ───────────────────── */
  var scheduleList = document.getElementById('scheduleList');
  function esc(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  if (scheduleList && user.schedule && user.schedule.length) {
    scheduleList.innerHTML = user.schedule.map(function (cls) {
      return '<li class="schedule-item">' +
        '<span class="schedule-time">' + esc(cls.time) + '</span>' +
        '<div class="schedule-body">' +
          '<div class="schedule-name-row">' +
            '<span class="schedule-name">' + esc(cls.name) + '</span>' +
            '<span class="live-badge" data-class-time="' + esc(cls.time) + '">Live</span>' +
          '</div>' +
          '<span class="schedule-meta">' + esc(cls.code) + ' \u00b7 ' + esc(cls.room) + ' \u00b7 ' + esc(cls.prof) + '</span>' +
        '</div>' +
      '</li>';
    }).join('');
  } else if (scheduleList) {
    scheduleList.innerHTML =
      '<li style="color:var(--clr-muted);font-size:0.825rem;padding:0.5rem 0;">' +
        'No classes scheduled for today.' +
      '</li>';
  }

  /* ── 2d. Upcoming Assignments ───────────────── */
  var assignList = document.getElementById('assignList');
  var fileSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  var dlSvg   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

  if (assignList && user.assignments && user.assignments.length) {
    assignList.innerHTML = user.assignments.map(function (a) {
      var iconClass = a.download ? 'assign-icon download' : 'assign-icon';
      var icon      = a.download ? dlSvg : fileSvg;
      return '<li class="assign-item">' +
        '<div class="' + iconClass + '" aria-hidden="true">' + icon + '</div>' +
        '<div class="assign-body">' +
          '<span class="assign-name">'    + esc(a.name)    + '</span>' +
          '<span class="assign-subject">' + esc(a.subject) + '</span>' +
        '</div>' +
        '<span class="assign-due">' + esc(a.due) + '</span>' +
      '</li>';
    }).join('');
  } else if (assignList) {
    assignList.innerHTML =
      '<li style="color:var(--clr-muted);font-size:0.825rem;padding:0.5rem 0;">' +
        'No pending assignments. Well done!' +
      '</li>';
  }

  /* ── 2e. Announcements ──────────────────────── */
  var announceList = document.getElementById('announceList');
  if (announceList && user.announcements && user.announcements.length) {
    var badgeNew = document.querySelector('.badge-new');
    if (badgeNew) badgeNew.textContent = user.announcements.length + ' new';

    announceList.innerHTML = user.announcements.map(function (a) {
      return '<li class="announce-item">' +
        '<div class="announce-dot" style="background:' + esc(a.color) + ';" aria-hidden="true"></div>' +
        '<div class="announce-body">' +
          '<span class="announce-title">' + esc(a.title)  + '</span>' +
          '<span class="announce-meta">'  + esc(a.source) + ' \u00a0\u00b7\u00a0 ' + esc(a.time) + '</span>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  /* ═══════════════════════════════════════════════════════════
     3. PAGE-SPECIFIC INTERACTIVE ACTIONS
  ═══════════════════════════════════════════════════════════ */

  /* ── 3a. Smart Reminders ───────────────────────────────── */
  var reminderBtn = document.getElementById('reminderBtn');
  if (reminderBtn) {
    reminderBtn.addEventListener('click', function () {
      var original = reminderBtn.textContent;
      reminderBtn.textContent      = 'Reminders enabled \u2713';
      reminderBtn.style.background = '#16a34a';
      reminderBtn.disabled         = true;

      showToast('Smart reminders enabled! You\'ll be notified before missed classes.', 'success', 3500);

      setTimeout(function () {
        reminderBtn.textContent      = original;
        reminderBtn.style.background = '';
        reminderBtn.disabled         = false;
      }, 3000);
    });
  }

  /* ── 3b. Quick Actions ─────────────────────────────────── */
  var quickItems = document.querySelectorAll('.quick-item');
  quickItems.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var page = btn.getAttribute('data-page');
      var targetUrl = '';
      if (page === 'timetable') targetUrl = 'timetableStudent.html';
      else if (page === 'assignments') targetUrl = 'assignmentsStudent.html';
      else if (page === 'events') targetUrl = 'eventsStudent.html';

      if (targetUrl) {
        showToast('Opening\u2026', 'info', 1000);
        setTimeout(function () { window.location.href = targetUrl; }, 300);
      }
    });
  });

  /* ── 3c. Panel Links ───────────────────────────────────── */
  var fullWeekLink  = document.getElementById('fullWeekLink');
  var viewAllAssign = document.getElementById('viewAllAssign');
  var browseEvents  = document.getElementById('browseEvents');

  if (fullWeekLink) {
    fullWeekLink.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = 'timetableStudent.html';
    });
  }

  if (viewAllAssign) {
    viewAllAssign.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = 'assignmentsStudent.html';
    });
  }

  if (browseEvents) {
    browseEvents.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = 'eventsStudent.html';
    });
  }

  /* ── 3d. Live Countdown Badges ─────────────────────────── */
  function updateLiveBadges() {
    var now     = new Date();
    var nowMins = now.getHours() * 60 + now.getMinutes();

    document.querySelectorAll('.live-badge[data-class-time]').forEach(function (badge) {
      var timeStr   = badge.getAttribute('data-class-time');
      if (!timeStr) return;
      var parts     = timeStr.split(':');
      var classMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      var diff      = classMins - nowMins;

      if (diff > 0 && diff <= 60) {
        badge.textContent    = 'Live in ' + diff + 'm';
        badge.style.display  = '';
      } else if (diff <= 0 && diff > -90) {
        badge.textContent    = 'Live now';
        badge.style.display  = '';
      } else {
        badge.style.display  = 'none';
      }
    });
  }

  updateLiveBadges();
  setInterval(updateLiveBadges, 60000);

}());
