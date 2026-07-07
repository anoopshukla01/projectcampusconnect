/**
 * StudentSphere – Shared JavaScript Module
 * File: studentCommon.js
 *
 * Implements common logic shared across all student dashboard sections.
 */

(function () {
  'use strict';

  // Global namespace
  var StudentSphere = {};

  /* ─────────────────────────────────────────────
     1. AUTH GUARD
     Checks for logged-in user in localStorage
  ───────────────────────────────────────────── */
  var raw = localStorage.getItem('ss_user');
  var user = null;
  try {
    user = raw ? JSON.parse(raw) : null;
  } catch (e) {
    user = null;
  }

  if (!user) {
    window.location.replace('../../LoginPage/login.html');
    return;
  }

  StudentSphere.user = user;

  /* ─────────────────────────────────────────────
     2. TOAST SYSTEM
  ───────────────────────────────────────────── */
  var toastTimer = null;
  StudentSphere.showToast = function (message, type, duration) {
    var toast = document.getElementById('toast');
    if (!toast) {
      // Create toast on demand if not in DOM
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      toast.setAttribute('role', 'alert');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }

    type = type || 'default';
    duration = duration || 3000;

    toast.className = 'toast';
    if (type === 'success') toast.classList.add('success');
    if (type === 'info')    toast.classList.add('info');

    toast.textContent = message;
    toast.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, duration);
  };

  /* ─────────────────────────────────────────────
     3. PROFILE & WIDGET INJECTION
  ───────────────────────────────────────────── */
  function getInitials(name) {
    if (!name) return '??';
    var parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  StudentSphere.populateHeader = function () {
    var elInitials = document.getElementById('avatarInitials');
    var elAvatarName = document.getElementById('avatarName');
    var elMeta = document.getElementById('welcomeMeta');

    if (elInitials)   elInitials.textContent = user.initials || getInitials(user.name);
    if (elAvatarName) elAvatarName.textContent = user.name;
    if (elMeta) {
      elMeta.textContent =
        user.branch + ' \u00b7 Semester ' + user.semester + ' \u00b7 Roll ' + user.roll;
    }

    // Sidebar task badge
    var sidebarAssignBadge = document.getElementById('sidebarAssignBadge');
    if (sidebarAssignBadge) sidebarAssignBadge.textContent = user.pendingTasks || 3;
  };

  /* ─────────────────────────────────────────────
     4. COMMON EVENT HANDLERS
  ───────────────────────────────────────────── */
  StudentSphere.init = function (pageName) {
    // 1. Populate header details
    StudentSphere.populateHeader();

    // 2. Set Active Menu Item
    var navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(function (item) {
      var isTarget = item.getAttribute('data-page') === pageName;
      item.classList.toggle('active', isTarget);
      item.setAttribute('aria-current', isTarget ? 'page' : 'false');
    });

    // 3. Navigation Clicks
    navItems.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var page = btn.getAttribute('data-page');
        if (page === pageName) return;

        var targetUrl = '';
        if (page === 'dashboard') targetUrl = '../dashboard/student.html';
        else if (page === 'timetable') targetUrl = '../timetable/timetableStudent.html';
        else if (page === 'attendance') targetUrl = '../attendance/attendanceStudent.html';
        else if (page === 'assignments') targetUrl = '../assignment/assignmentsStudent.html';
        else if (page === 'lectures') targetUrl = '../lectures/lecturesStudent.html';
        else if (page === 'elibrary') targetUrl = '../e-library/elibraryStudent.html';
        else if (page === 'notes') targetUrl = '../notes & pyq\'s/notesStudent.html';
        else if (page === 'grades') targetUrl = '../grade book/gradesStudent.html';
        else if (page === 'chats') targetUrl = '../chats/chatsStudent.html';
        else if (page === 'events') targetUrl = '../events/eventsStudent.html';
        else if (page === 'marketplace') targetUrl = '../marketplace/marketplaceStudent.html';
        else if (page === 'lostandfound') targetUrl = '../lost and found/lostandfoundStudent.html';
        else if (page === 'internships') targetUrl = '../internship/internshipsStudent.html';
        else if (page === 'resume') targetUrl = '../resume builder/resumeStudent.html';
        else if (page === 'mentorship') targetUrl = '../mentorship/mentorshipStudent.html';
        else if (page === 'mock') targetUrl = '../mock /mockStudent.html';

        if (targetUrl) {
          if (window.innerWidth <= 768) { closeSidebar(); }
          StudentSphere.showToast('Loading page\u2026', 'info', 800);
          setTimeout(function () {
            window.location.href = targetUrl;
          }, 200);
        }
      });
    });

    // 4. Mobile Toggle
    var sidebar = document.getElementById('sidebar');
    var sidebarOverlay = document.getElementById('sidebarOverlay');
    var menuToggle = document.getElementById('menuToggle');

    function openSidebar() {
      if (sidebar) sidebar.classList.add('open');
      if (sidebarOverlay) {
        sidebarOverlay.classList.add('visible');
        sidebarOverlay.removeAttribute('aria-hidden');
      }
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
      if (sidebar) sidebar.classList.remove('open');
      if (sidebarOverlay) {
        sidebarOverlay.classList.remove('visible');
        sidebarOverlay.setAttribute('aria-hidden', 'true');
      }
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    if (menuToggle) {
      menuToggle.addEventListener('click', function () {
        if (sidebar && sidebar.classList.contains('open')) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });
    }

    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', closeSidebar);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar && sidebar.classList.contains('open')) {
        closeSidebar();
      }
    });

    // 5. Notifications
    var notifBtn = document.getElementById('notifBtn');
    var notifDot = document.querySelector('.notif-dot');
    if (notifBtn) {
      notifBtn.addEventListener('click', function () {
        if (notifDot) notifDot.style.display = 'none';
        StudentSphere.showToast('Notifications — Panel coming soon!', 'info', 2500);
      });
    }

    // 6. Sign Out
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        localStorage.removeItem('ss_user');
        StudentSphere.showToast('Signing out\u2026', 'info', 1200);
        setTimeout(function () {
          window.location.href = '../../LoginPage/login.html';
        }, 800);
      });
    }

    // 7. Profile button
    var avatarBtn = document.getElementById('avatarBtn');
    if (avatarBtn) {
      avatarBtn.addEventListener('click', function () {
        StudentSphere.showToast('Profile & settings coming soon!', 'info', 2000);
      });
    }

    // 8. Sidebar Search Filter
    var sidebarSearch = document.getElementById('sidebarSearch');
    if (sidebarSearch) {
      sidebarSearch.addEventListener('input', function () {
        var query = sidebarSearch.value.trim().toLowerCase();
        navItems.forEach(function (btn) {
          var text = btn.textContent.trim().toLowerCase();
          var li = btn.closest('li');
          if (!li) return;
          li.style.display = (!query || text.includes(query)) ? '' : 'none';
        });

        document.querySelectorAll('.nav-section').forEach(function (section) {
          var visible = section.querySelectorAll('li:not([style*="display: none"])');
          section.style.display = (visible.length === 0 && query) ? 'none' : '';
        });
      });

      sidebarSearch.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          sidebarSearch.value = '';
          sidebarSearch.dispatchEvent(new Event('input'));
          sidebarSearch.blur();
        }
      });
    }
  };

  // Expose to window
  window.StudentSphere = StudentSphere;

}());
