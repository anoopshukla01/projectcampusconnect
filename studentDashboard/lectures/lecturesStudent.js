/**
 * StudentSphere – Student Lectures Portal Logic
 * File: lecturesStudent.js
 */

(function () {
  'use strict';

  if (!window.StudentSphere || !window.StudentSphere.user) {
    return;
  }

  var user = window.StudentSphere.user;
  var showToast = window.StudentSphere.user ? window.StudentSphere.showToast : null;
  window.StudentSphere.init('lectures');

  /* ─────────────────────────────────────────────
     1. PARSE / INITIALIZE ACADEMIC DATA
  ───────────────────────────────────────────── */
  var branch = (user.branch || '').toLowerCase();
  var syllabus = [];
  var recordings = [];

  if (branch.includes('communication') || branch.includes('electronics')) {
    syllabus = [
      { name: 'Signals & Systems', code: 'EC3021', module: 'Module 4 of 5', progress: 78 },
      { name: 'VLSI Design', code: 'EC3031', module: 'Module 3 of 5', progress: 60 },
      { name: 'Electromagnetic Waves', code: 'EC3041', module: 'Module 4 of 5', progress: 85 },
      { name: 'Digital Signal Processing', code: 'EC3051', module: 'Module 5 of 5', progress: 92 }
    ];

    recordings = [
      { id: 1, title: 'Fourier Series and Continuous Time Signals', code: 'EC3021', prof: 'Dr. Kavitha Menon', date: '3 days ago', duration: '55:20', subject: 'Signals & Systems' },
      { id: 2, title: 'CMOS Inverter Design Rules & Sizing', code: 'EC3031', prof: 'Dr. Suresh Babu', date: '4 days ago', duration: '1:12:05', subject: 'VLSI Design' },
      { id: 3, title: 'Maxwell Equations & Boundary Conditions', code: 'EC3041', prof: 'Dr. Kavitha Menon', date: '1 week ago', duration: '48:15', subject: 'Electromagnetic Waves' },
      { id: 4, title: 'Fast Fourier Transform (FFT) Decimation', code: 'EC3051', prof: 'Dr. Suresh Babu', date: '1 week ago', duration: '1:02:40', subject: 'Digital Signal Processing' },
      { id: 5, title: 'Z-Transform & Regional Convergence', code: 'EC3021', prof: 'Dr. Kavitha Menon', date: '2 weeks ago', duration: '58:00', subject: 'Signals & Systems' }
    ];
  } else if (branch.includes('mechanical')) {
    syllabus = [
      { name: 'Thermodynamics', code: 'ME3011', module: 'Module 3 of 5', progress: 55 },
      { name: 'Fluid Mechanics', code: 'ME3021', module: 'Module 4 of 5', progress: 75 },
      { name: 'Kinematics of Machines', code: 'ME3031', module: 'Module 4 of 5', progress: 80 },
      { name: 'Material Science', code: 'ME3041', module: 'Module 5 of 5', progress: 90 }
    ];

    recordings = [
      { id: 1, title: 'First Law of Thermodynamics - Open Systems', code: 'ME3011', prof: 'Dr. Ramesh Kumar', date: '2 days ago', duration: '1:04:12', subject: 'Thermodynamics' },
      { id: 2, title: 'Bernoulli Equation and Flow Measurement', code: 'ME3021', prof: 'Dr. Anil Sharma', date: '4 days ago', duration: '52:10', subject: 'Fluid Mechanics' },
      { id: 3, title: 'Gear Train Analysis & Epicyclic Systems', code: 'ME3031', prof: 'Dr. Ramesh Kumar', date: '5 days ago', duration: '1:15:30', subject: 'Kinematics of Machines' },
      { id: 4, title: 'Crystal Structure & Imperfection in Solids', code: 'ME3041', prof: 'Dr. Anil Sharma', date: '1 week ago', duration: '46:00', subject: 'Material Science' },
      { id: 5, title: 'Entropy Changes in Ideal Gas Cycles', code: 'ME3011', prof: 'Dr. Ramesh Kumar', date: '2 weeks ago', duration: '59:20', subject: 'Thermodynamics' }
    ];
  } else {
    // Computer Science
    syllabus = [
      { name: 'Computer networks', code: 'CS3081', module: 'Module 4 of 5', progress: 80 },
      { name: 'Software engineering', code: 'CS3041', module: 'Module 3 of 5', progress: 65 },
      { name: 'Database systems', code: 'CS3051', module: 'Module 4 of 5', progress: 75 },
      { name: 'Theory of computation', code: 'CS3061', module: 'Module 5 of 5', progress: 90 }
    ];

    recordings = [
      { id: 1, title: 'IP Addressing, Subnetting & CIDR Notation', code: 'CS3081', prof: 'Dr. Sneha Patel', date: '2 days ago', duration: '58:45', subject: 'Computer networks' },
      { id: 2, title: 'Agile Methodologies & Scrum Framework', code: 'CS3041', prof: 'Dr. Rohan Mehra', date: '3 days ago', duration: '1:05:10', subject: 'Software engineering' },
      { id: 3, title: 'Normalization: 1NF, 2NF, 3NF & BCNF', code: 'CS3051', prof: 'Dr. Arjun Nair', date: '5 days ago', duration: '1:14:00', subject: 'Database systems' },
      { id: 4, title: 'Pushdown Automata & Context Free Grammars', code: 'CS3061', prof: 'Dr. Sneha Patel', date: '1 week ago', duration: '52:30', subject: 'Theory of computation' },
      { id: 5, title: 'Routing Algorithms: Link State & Distance Vector', code: 'CS3081', prof: 'Dr. Sneha Patel', date: '1 week ago', duration: '1:01:20', subject: 'Computer networks' }
    ];
  }

  var activeFilter = 'all';

  /* ─────────────────────────────────────────────
     2. RENDER SYLLABUS PROGRESS
  ───────────────────────────────────────────── */
  var syllabusGrid = document.getElementById('syllabusGrid');
  if (syllabusGrid) {
    syllabusGrid.innerHTML = syllabus.map(function (s) {
      return (
        '<div class="syllabus-card">' +
          '<span class="syllabus-name">' + s.name + ' (' + s.code + ')</span>' +
          '<div class="syllabus-meta">' +
            '<span>' + s.module + '</span>' +
            '<span style="font-weight:700;color:var(--clr-text);">' + s.progress + '%</span>' +
          '</div>' +
          '<div class="syllabus-bar">' +
            '<div class="syllabus-bar-fill" style="width:' + s.progress + '%;"></div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  /* ─────────────────────────────────────────────
     3. RENDER LIVE LECTURES (FROM USER TODAY SCHEDULE)
  ───────────────────────────────────────────── */
  var liveGrid = document.getElementById('liveGrid');
  if (liveGrid) {
    var todaySchedule = user.schedule || [];
    if (todaySchedule.length > 0) {
      liveGrid.innerHTML = todaySchedule.map(function (cls) {
        return (
          '<div class="live-card">' +
            '<div class="live-pulse-badge">' +
              '<span class="live-pulse-dot"></span>' +
              'Live' +
            '</div>' +
            '<span class="video-subject">' + cls.code + '</span>' +
            '<h3 class="live-title">' + cls.name + '</h3>' +
            '<div class="live-time-row">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' +
              '</svg>' +
              '<span>' + cls.time + ' \u00b7 ' + cls.room + '</span>' +
            '</div>' +
            '<span class="video-meta" style="font-size:0.75rem;margin-bottom:0.25rem;">Instructor: ' + cls.prof + '</span>' +
            '<button class="live-join-btn">Join Classroom</button>' +
          '</div>'
        );
      }).join('');
      
      // Bind Join clicks
      liveGrid.querySelectorAll('.live-join-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var title = btn.closest('.live-card').querySelector('.live-title').textContent;
          window.StudentSphere.showToast('Launching video streaming for ' + title + '\u2026', 'success', 3000);
        });
      });
    } else {
      liveGrid.innerHTML = '<div style="color:var(--clr-muted);font-size:0.85rem;grid-column:1/-1;">No live lectures streaming at the moment.</div>';
    }
  }

  /* ─────────────────────────────────────────────
     4. RENDER PAST RECORDINGS & SUBJECT FILTERS
  ───────────────────────────────────────────── */
  var filterContainer = document.querySelector('.filter-group');
  var recordingsGrid = document.getElementById('recordingsGrid');

  function renderFilterButtons() {
    if (!filterContainer) return;
    
    // Collect unique subject codes
    var codes = ['all'];
    syllabus.forEach(function (s) {
      codes.push(s.code);
    });

    filterContainer.innerHTML = codes.map(function (c) {
      var label = c === 'all' ? 'All Subjects' : c;
      var activeClass = c === activeFilter ? ' active' : '';
      return '<button class="filter-btn' + activeClass + '" data-sub="' + c + '">' + label + '</button>';
    }).join('');

    // Bind clicks
    filterContainer.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeFilter = btn.getAttribute('data-sub');
        renderFilterButtons();
        renderRecordings();
      });
    });
  }

  function renderRecordings() {
    if (!recordingsGrid) return;

    var filtered = recordings.filter(function (r) {
      if (activeFilter === 'all') return true;
      return r.code === activeFilter;
    });

    if (filtered.length === 0) {
      recordingsGrid.innerHTML = '<div style="color:var(--clr-muted);grid-column:1/-1;text-align:center;padding:2rem;">No recorded lectures matching this subject filter.</div>';
      return;
    }

    recordingsGrid.innerHTML = filtered.map(function (r) {
      return (
        '<div class="recording-card">' +
          '<div class="video-thumb" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
              '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>' +
            '</svg>' +
            '<span class="video-duration">' + r.duration + '</span>' +
          '</div>' +
          '<div class="video-body">' +
            '<span class="video-subject">' + r.code + ' \u00b7 ' + r.subject + '</span>' +
            '<h3 class="video-title">' + r.title + '</h3>' +
            '<span class="video-meta">' + r.prof + ' \u00b7 ' + r.date + '</span>' +
          '</div>' +
          '<div class="video-footer">' +
            '<a href="#" class="video-watch-link" data-id="' + r.id + '">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>' +
              '</svg>' +
              'Watch Now' +
            '</a>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    // Bind Watch Clicks
    recordingsGrid.querySelectorAll('.video-watch-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var card = link.closest('.recording-card');
        var title = card.querySelector('.video-title').textContent;
        window.StudentSphere.showToast('Streaming recording: ' + title, 'info', 3000);
      });
    });
  }

  // Init
  renderFilterButtons();
  renderRecordings();

}());
