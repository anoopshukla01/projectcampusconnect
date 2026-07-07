/**
 * StudentSphere – Student Attendance Tracker Logic
 * File: attendanceStudent.js
 */

(function () {
  'use strict';

  if (!window.StudentSphere || !window.StudentSphere.user) {
    return;
  }

  var user = window.StudentSphere.user;
  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('attendance');

  /* ─────────────────────────────────────────────
     1. ATTENDANCE DATA GENERATION
     Personalized list of courses based on user's branch
  ───────────────────────────────────────────── */
  var branch = (user.branch || '').toLowerCase();
  var subjects = [];

  if (branch.includes('communication') || branch.includes('electronics')) {
    subjects = [
      { name: 'Signals & Systems', code: 'EC3021', attended: 28, total: 30, pct: 93 },
      { name: 'VLSI Design', code: 'EC3031', attended: 23, total: 25, pct: 92 },
      { name: 'VLSI Design Lab', code: 'EC3032', attended: 10, total: 10, pct: 100 },
      { name: 'Electromagnetic Waves', code: 'EC3041', attended: 21, total: 24, pct: 87 },
      { name: 'Digital Signal Processing', code: 'EC3051', attended: 23, total: 25, pct: 92 },
      { name: 'DSP & Systems Lab', code: 'EC3052', attended: 9, total: 10, pct: 90 }
    ];
  } else if (branch.includes('mechanical')) {
    subjects = [
      { name: 'Thermodynamics', code: 'ME3011', attended: 22, total: 27, pct: 81 },
      { name: 'Fluid Mechanics', code: 'ME3021', attended: 20, total: 25, pct: 80 },
      { name: 'Fluid Mechanics Lab', code: 'ME3022', attended: 9, total: 10, pct: 90 },
      { name: 'Kinematics of Machines', code: 'ME3031', attended: 23, total: 30, pct: 76 },
      { name: 'Material Science', code: 'ME3041', attended: 24, total: 30, pct: 80 },
      { name: 'Machine Shop Practice', code: 'ME3032', attended: 8, total: 10, pct: 80 }
    ];
  } else {
    // Computer Science (Default)
    subjects = [
      { name: 'Computer networks', code: 'CS3081', attended: 26, total: 30, pct: 86 },
      { name: 'Software engineering', code: 'CS3041', attended: 23, total: 26, pct: 88 },
      { name: 'Database systems', code: 'CS3051', attended: 21, total: 28, pct: 75 },
      { name: 'Network & SE Lab', code: 'CS3082', attended: 10, total: 10, pct: 100 },
      { name: 'Theory of computation', code: 'CS3061', attended: 24, total: 25, pct: 96 },
      { name: 'DBMS & Projects Lab', code: 'CS3052', attended: 8, total: 10, pct: 80 }
    ];
  }

  // Parse total attendance based on sum of classes
  var totalAttended = 0;
  var totalClasses = 0;
  subjects.forEach(function (sub) {
    totalAttended += sub.attended;
    totalClasses += sub.total;
  });

  var overallPct = Math.round((totalAttended / totalClasses) * 100);

  /* ─────────────────────────────────────────────
     2. RENDER SUMMARY PROGRESS CIRCLE
  ───────────────────────────────────────────── */
  var summaryCircleProgress = document.getElementById('summaryCircleProgress');
  var summaryPctText = document.getElementById('summaryPctText');
  var summarySubText = document.getElementById('summarySubText');

  if (summaryPctText) summaryPctText.textContent = overallPct + '%';
  if (summaryCircleProgress) {
    // Circle radius is 15.9155, circumference is 100
    summaryCircleProgress.setAttribute('stroke-dasharray', overallPct + ', 100');
    if (overallPct < 75) {
      summaryCircleProgress.style.stroke = 'var(--clr-danger)';
    } else if (overallPct < 80) {
      summaryCircleProgress.style.stroke = 'var(--clr-warning)';
    }
  }

  if (summarySubText) {
    if (overallPct >= 75) {
      var diff = overallPct - 75;
      summarySubText.textContent = 'Safe \u00b7 ' + diff + '% above minimum required (75%)';
      summarySubText.className = 'summary-sub';
    } else {
      var needed = Math.ceil((0.75 * totalClasses) - totalAttended);
      summarySubText.textContent = 'Critical! Below 75%. Attend ' + needed + ' classes consecutively.';
      summarySubText.className = 'summary-sub danger-alert';
    }
  }

  /* ─────────────────────────────────────────────
     3. BUNK CALCULATOR LOGIC
  ───────────────────────────────────────────── */
  var selectSubject = document.getElementById('calcSubjectSelect');
  var btnBunkOne = document.getElementById('btnBunkOne');
  var btnBunkMany = document.getElementById('btnBunkMany');
  var calcResult = document.getElementById('calcResult');

  if (selectSubject) {
    selectSubject.innerHTML = subjects.map(function (sub) {
      return '<option value="' + sub.code + '">' + sub.name + ' (' + sub.code + ')</option>';
    }).join('');
  }

  function getSelectedSubject() {
    var code = selectSubject.value;
    for (var i = 0; i < subjects.length; i++) {
      if (subjects[i].code === code) return subjects[i];
    }
    return null;
  }

  if (btnBunkOne) {
    btnBunkOne.addEventListener('click', function () {
      var sub = getSelectedSubject();
      if (!sub) return;

      var newPct = Math.round((sub.attended / (sub.total + 1)) * 100);
      if (newPct >= 75) {
        calcResult.textContent = 'Yes, you can bunk the next class. Attendance will drop from ' + sub.pct + '% to ' + newPct + '%, which remains safe.';
        calcResult.style.borderLeftColor = 'var(--clr-success)';
      } else {
        calcResult.textContent = 'No! Bunking the next class will drop your attendance to ' + newPct + '%, which is below the 75% limit.';
        calcResult.style.borderLeftColor = 'var(--clr-danger)';
      }
    });
  }

  if (btnBunkMany) {
    btnBunkMany.addEventListener('click', function () {
      var sub = getSelectedSubject();
      if (!sub) return;

      // Find max class bunks: (attended) / (total + x) >= 0.75 => x <= (attended / 0.75) - total
      var maxBunks = 0;
      while (Math.round((sub.attended / (sub.total + maxBunks + 1)) * 100) >= 75) {
        maxBunks++;
      }

      if (maxBunks > 0) {
        calcResult.textContent = 'You can skip up to ' + maxBunks + ' class(es) consecutively. Your attendance will become ' + Math.round((sub.attended / (sub.total + maxBunks)) * 100) + '%.';
        calcResult.style.borderLeftColor = 'var(--clr-primary)';
      } else {
        var needed = Math.ceil((0.75 * sub.total) - sub.attended);
        calcResult.textContent = 'You cannot skip any class. You must attend ' + needed + ' classes consecutively to hit 75%.';
        calcResult.style.borderLeftColor = 'var(--clr-warning)';
      }
    });
  }

  /* ─────────────────────────────────────────────
     4. RENDER SUBJECT CARDS
  ───────────────────────────────────────────── */
  var subjectGrid = document.getElementById('subjectGrid');
  if (subjectGrid) {
    subjectGrid.innerHTML = subjects.map(function (sub) {
      var badgeClass = 'status-badge';
      var badgeText = 'Safe';
      var fillStyle = 'background:var(--clr-success);';

      if (sub.pct < 75) {
        badgeClass += ' critical';
        badgeText = 'Critical';
        fillStyle = 'background:var(--clr-danger);';
      } else if (sub.pct < 80) {
        badgeClass += ' warning';
        badgeText = 'Low';
        fillStyle = 'background:var(--clr-warning);';
      } else {
        badgeClass += ' safe';
      }

      return (
        '<div class="subject-card">' +
          '<div class="sub-header">' +
            '<div>' +
              '<span class="sub-name">' + sub.name + '</span>' +
              '<span class="sub-code">' + sub.code + '</span>' +
            '</div>' +
            '<span class="sub-pct-label">' + sub.pct + '%</span>' +
          '</div>' +
          '<div class="sub-bar-container">' +
            '<div class="sub-bar">' +
              '<div class="sub-bar-fill" style="width:' + sub.pct + '%;' + fillStyle + '"></div>' +
            '</div>' +
            '<div class="sub-details">' +
              '<span>' + sub.attended + '/' + sub.total + ' classes</span>' +
              '<span class="' + badgeClass + '">' + badgeText + '</span>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  /* ─────────────────────────────────────────────
     5. RENDER RECENT ATTENDANCE LOG
  ───────────────────────────────────────────── */
  var logBody = document.getElementById('attendanceLogBody');
  if (logBody) {
    var logs = [
      { date: 'Nov 24, 2026', subject: subjects[0] ? subjects[0].name : 'Course 1', slot: '09:00 - 10:30', prof: 'Dr. Sneha Patel', present: true },
      { date: 'Nov 24, 2026', subject: subjects[1] ? subjects[1].name : 'Course 2', slot: '11:00 - 12:30', prof: 'Dr. Rohan Mehra', present: true },
      { date: 'Nov 23, 2026', subject: subjects[2] ? subjects[2].name : 'Course 3', slot: '13:00 - 16:00', prof: 'Dr. Arjun Nair', present: false },
      { date: 'Nov 23, 2026', subject: subjects[0] ? subjects[0].name : 'Course 1', slot: '09:00 - 10:30', prof: 'Dr. Sneha Patel', present: true },
      { date: 'Nov 20, 2026', subject: subjects[4] ? subjects[4].name : 'Course 5', slot: '11:00 - 12:30', prof: 'Dr. Vikram Singh', present: true }
    ];

    logBody.innerHTML = logs.map(function (log) {
      var badge = log.present ? '<span class="log-badge present">Present</span>' : '<span class="log-badge absent">Absent</span>';
      return (
        '<tr>' +
          '<td>' + log.date + '</td>' +
          '<td style="font-weight:600;">' + log.subject + '</td>' +
          '<td>' + log.slot + '</td>' +
          '<td>' + log.prof + '</td>' +
          '<td>' + badge + '</td>' +
        '</tr>'
      );
    }).join('');
  }

}());
