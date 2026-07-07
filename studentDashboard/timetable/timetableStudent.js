/**
 * StudentSphere – Timetable Student Interface Logic
 * File: timetableStudent.js
 */

(function () {
  'use strict';

  // 1. Initialize Common system
  if (!window.StudentSphere || !window.StudentSphere.user) {
    return; // Auth guard redirected
  }

  var user = window.StudentSphere.user;
  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('timetable');

  /* ═══════════════════════════════════════════════════════════
     2. DYNAMIC SCHEDULE GENERATOR
  ═══════════════════════════════════════════════════════════ */
  var WEEK_DAYS = [
    { key: 'Mon', label: 'Monday', sub: 'Day 1' },
    { key: 'Tue', label: 'Tuesday', sub: 'Day 2' },
    { key: 'Wed', label: 'Wednesday', sub: 'Day 3' },
    { key: 'Thu', label: 'Thursday', sub: 'Day 4' },
    { key: 'Fri', label: 'Friday', sub: 'Day 5' }
  ];

  var branch = (user.branch || '').toLowerCase();
  var timetableData = {};

  if (branch.includes('communication') || branch.includes('electronics')) {
    timetableData = {
      Mon: [
        { time: '10:00 - 11:30', name: 'Signals & Systems', code: 'EC3021', room: 'LH-102', prof: 'Dr. Kavitha Menon', type: 'lecture' },
        { time: '13:00 - 14:30', name: 'VLSI Design', code: 'EC3031', room: 'LH-210', prof: 'Dr. Suresh Babu', type: 'lecture' }
      ],
      Tue: [
        { time: '09:00 - 10:30', name: 'Electromagnetic Waves', code: 'EC3041', room: 'LH-102', prof: 'Dr. Kavitha Menon', type: 'lecture' },
        { time: '11:00 - 12:30', name: 'Digital Signal Processing', code: 'EC3051', room: 'LH-210', prof: 'Dr. Suresh Babu', type: 'lecture' }
      ],
      Wed: [
        { time: '10:00 - 11:30', name: 'Signals & Systems', code: 'EC3021', room: 'LH-102', prof: 'Dr. Kavitha Menon', type: 'lecture' },
        { time: '14:00 - 17:00', name: 'VLSI Design Lab', code: 'EC3032', room: 'Lab-5', prof: 'Dr. Suresh Babu', type: 'lab' }
      ],
      Thu: [
        { time: '09:00 - 10:30', name: 'Electromagnetic Waves', code: 'EC3041', room: 'LH-102', prof: 'Dr. Kavitha Menon', type: 'lecture' },
        { time: '11:00 - 12:30', name: 'Digital Signal Processing', code: 'EC3051', room: 'LH-210', prof: 'Dr. Suresh Babu', type: 'lecture' }
      ],
      Fri: [
        { time: '09:00 - 12:00', name: 'DSP & Systems Lab', code: 'EC3052', room: 'Lab-6', prof: 'Dr. Kavitha Menon', type: 'lab' },
        { time: '14:00 - 15:30', name: 'Semiconductor Seminar', code: 'EC3081', room: 'Aud-1', prof: 'Dr. Suresh Babu', type: 'seminar' }
      ]
    };
  } else if (branch.includes('mechanical')) {
    timetableData = {
      Mon: [
        { time: '08:00 - 09:30', name: 'Thermodynamics', code: 'ME3011', room: 'LH-401', prof: 'Dr. Ramesh Kumar', type: 'lecture' },
        { time: '12:00 - 13:30', name: 'Fluid Mechanics', code: 'ME3021', room: 'Lab-3', prof: 'Dr. Anil Sharma', type: 'lecture' }
      ],
      Tue: [
        { time: '09:00 - 10:30', name: 'Kinematics of Machines', code: 'ME3031', room: 'LH-402', prof: 'Dr. Ramesh Kumar', type: 'lecture' },
        { time: '11:00 - 12:30', name: 'Material Science', code: 'ME3041', room: 'LH-402', prof: 'Dr. Anil Sharma', type: 'lecture' }
      ],
      Wed: [
        { time: '08:00 - 09:30', name: 'Thermodynamics', code: 'ME3011', room: 'LH-401', prof: 'Dr. Ramesh Kumar', type: 'lecture' },
        { time: '14:00 - 17:00', name: 'Fluid Mechanics Lab', code: 'ME3022', room: 'Lab-3', prof: 'Dr. Anil Sharma', type: 'lab' }
      ],
      Thu: [
        { time: '09:00 - 10:30', name: 'Kinematics of Machines', code: 'ME3031', room: 'LH-402', prof: 'Dr. Ramesh Kumar', type: 'lecture' },
        { time: '11:00 - 12:30', name: 'Material Science', code: 'ME3041', room: 'LH-402', prof: 'Dr. Anil Sharma', type: 'lecture' }
      ],
      Fri: [
        { time: '09:00 - 12:00', name: 'Machine Shop Practice', code: 'ME3032', room: 'Workshop-1', prof: 'Dr. Ramesh Kumar', type: 'lab' },
        { time: '14:00 - 15:30', name: 'CAD/CAM Seminar', code: 'ME3061', room: 'Aud-3', prof: 'Dr. Anil Sharma', type: 'seminar' }
      ]
    };
  } else {
    // Computer Science
    timetableData = {
      Mon: [
        { time: '09:00 - 10:30', name: 'Computer networks', code: 'CS3081', room: 'LH-201', prof: 'Dr. Sneha Patel', type: 'lecture' },
        { time: '11:00 - 12:30', name: 'Software engineering', code: 'CS3041', room: 'LH-108', prof: 'Dr. Rohan Mehra', type: 'lecture' },
        { time: '14:00 - 15:30', name: 'Database systems', code: 'CS3051', room: 'LH-305', prof: 'Dr. Arjun Nair', type: 'lecture' }
      ],
      Tue: [
        { time: '09:00 - 12:00', name: 'Network & SE Lab', code: 'CS3082', room: 'Lab-2', prof: 'Dr. Sneha Patel', type: 'lab' },
        { time: '13:30 - 15:00', name: 'Theory of computation', code: 'CS3061', room: 'LH-201', prof: 'Dr. Sneha Patel', type: 'lecture' }
      ],
      Wed: [
        { time: '09:00 - 10:30', name: 'Computer networks', code: 'CS3081', room: 'LH-201', prof: 'Dr. Sneha Patel', type: 'lecture' },
        { time: '11:00 - 12:30', name: 'Software engineering', code: 'CS3041', room: 'LH-108', prof: 'Dr. Rohan Mehra', type: 'lecture' },
        { time: '15:00 - 16:30', name: 'Technical Writing Seminar', code: 'HS3011', room: 'Aud-2', prof: 'Dr. Vikram Singh', type: 'seminar' }
      ],
      Thu: [
        { time: '10:00 - 11:30', name: 'Database systems', code: 'CS3051', room: 'LH-305', prof: 'Dr. Arjun Nair', type: 'lecture' },
        { time: '13:00 - 16:00', name: 'DBMS & Projects Lab', code: 'CS3052', room: 'Lab-4', prof: 'Dr. Arjun Nair', type: 'lab' }
      ],
      Fri: [
        { time: '09:00 - 10:30', name: 'Theory of computation', code: 'CS3061', room: 'LH-201', prof: 'Dr. Sneha Patel', type: 'lecture' },
        { time: '11:00 - 12:30', name: 'Cloud Computing', code: 'CS4021', room: 'LH-108', prof: 'Dr. Vikram Singh', type: 'lecture' }
      ]
    };
  }

  /* ═══════════════════════════════════════════════════════════
     3. RENDER TIMETABLE
  ═══════════════════════════════════════════════════════════ */
  var gridContainer = document.getElementById('timetableGridContainer');
  var activeFilter = 'all';
  var searchQuery = '';
  var activeMobileDay = 'Mon';

  function esc(val) {
    if (val === undefined || val === null) return '';
    return String(val)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  function renderTimetable() {
    if (!gridContainer) return;

    var html = '';

    WEEK_DAYS.forEach(function (day) {
      var classes = timetableData[day.key] || [];

      // Filter classes
      var filteredClasses = classes.filter(function (cls) {
        if (activeFilter !== 'all') {
          if (activeFilter === 'lecture' && cls.type !== 'lecture') return false;
          if (activeFilter === 'lab' && cls.type !== 'lab') return false;
        }

        if (searchQuery) {
          var name = cls.name.toLowerCase();
          var room = cls.room.toLowerCase();
          var prof = cls.prof.toLowerCase();
          var code = cls.code.toLowerCase();
          return name.includes(searchQuery) ||
                 room.includes(searchQuery) ||
                 prof.includes(searchQuery) ||
                 code.includes(searchQuery);
        }

        return true;
      });

      var activeDayClass = (day.key === activeMobileDay) ? ' active-day-col' : '';

      html += '<div class="day-column' + activeDayClass + '" data-day-key="' + day.key + '">';
      html += '  <div class="day-header">';
      html += '    <span class="day-title">' + day.label + '</span>';
      html += '    <span class="day-subtitle">' + day.sub + '</span>';
      html += '  </div>';
      html += '  <div class="classes-list">';

      if (filteredClasses.length > 0) {
        filteredClasses.forEach(function (cls) {
          var badgeClass = 'class-badge';
          if (cls.type === 'lecture') badgeClass += ' badge-lecture';
          if (cls.type === 'lab')     badgeClass += ' badge-lab';
          if (cls.type === 'seminar') badgeClass += ' badge-seminar';

          html += '    <div class="class-card">';
          html += '      <span class="class-time">' + esc(cls.time) + '</span>';
          html += '      <span class="class-name">' + esc(cls.name) + '</span>';
          html += '      <span class="class-meta">' + esc(cls.code) + ' \u00b7 ' + esc(cls.room) + ' \u00b7 ' + esc(cls.prof) + '</span>';
          html += '      <span class="' + badgeClass + '">' + esc(cls.type) + '</span>';
          html += '    </div>';
        });
      } else {
        html += '    <div class="no-class-message">';
        html += '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
        html += '        <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>';
        html += '      </svg>';
        html += '      No classes match';
        html += '    </div>';
      }

      html += '  </div>';
      html += '</div>';
    });

    gridContainer.innerHTML = html;
  }

  /* ═══════════════════════════════════════════════════════════
     4. EVENT LISTENERS
  ═══════════════════════════════════════════════════════════ */
  var filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter');
      renderTimetable();
      showToast('Filtered by ' + activeFilter, 'info', 1000);
    });
  });

  var dayTabs = document.querySelectorAll('.day-tab');
  dayTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      dayTabs.forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeMobileDay = tab.getAttribute('data-day');
      renderTimetable();
    });
  });

  var exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      showToast('Timetable PDF generated & downloading\u2026', 'success', 3000);
    });
  }

  // Sidebar class search listener override
  var sidebarSearch = document.getElementById('sidebarSearch');
  if (sidebarSearch) {
    sidebarSearch.addEventListener('input', function () {
      searchQuery = sidebarSearch.value.trim().toLowerCase();
      renderTimetable();
    });
  }

  // Init
  renderTimetable();

}());
