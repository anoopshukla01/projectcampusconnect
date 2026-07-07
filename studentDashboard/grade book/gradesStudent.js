/**
 * StudentSphere – Student Grades Page Logic
 * File: gradesStudent.js
 */

(function () {
  'use strict';

  if (!window.StudentSphere || !window.StudentSphere.user) {
    return;
  }

  var user = window.StudentSphere.user;
  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('grades');

  /* ─────────────────────────────────────────────
     1. INITIALIZE GRADE CARD DATA
  ───────────────────────────────────────────── */
  var cgpaVal = parseFloat(user.cgpa) || 8.0;
  var branch = (user.branch || '').toLowerCase();
  
  // Custom mock SGPAs for past 5 semesters
  var sgpaHistory = [8.40, 8.62, 8.55, 8.80, 8.94];
  if (cgpaVal > 9.0) {
    sgpaHistory = [8.90, 9.10, 9.05, 9.20, 9.34];
  } else if (cgpaVal < 8.0) {
    sgpaHistory = [7.50, 7.82, 7.60, 7.45, 7.65];
  }

  var gradesData = [];
  if (branch.includes('communication') || branch.includes('electronics')) {
    gradesData = [
      { name: 'Signals & Systems', code: 'EC3021', credits: 4, grade: 'A', score: '84' },
      { name: 'VLSI Design', code: 'EC3031', credits: 4, grade: 'A+', score: '91' },
      { name: 'VLSI Design Lab', code: 'EC3032', credits: 2, grade: 'O', score: '98' },
      { name: 'Electromagnetic Waves', code: 'EC3041', credits: 3, grade: 'B+', score: '78' },
      { name: 'Digital Signal Processing', code: 'EC3051', credits: 4, grade: 'A', score: '82' },
      { name: 'DSP & Systems Lab', code: 'EC3052', credits: 2, grade: 'A+', score: '90' }
    ];
  } else if (branch.includes('mechanical')) {
    gradesData = [
      { name: 'Thermodynamics', code: 'ME3011', credits: 4, grade: 'B', score: '68' },
      { name: 'Fluid Mechanics', code: 'ME3021', credits: 4, grade: 'B+', score: '76' },
      { name: 'Fluid Mechanics Lab', code: 'ME3022', credits: 2, grade: 'A+', score: '92' },
      { name: 'Kinematics of Machines', code: 'ME3031', credits: 3, grade: 'B', score: '69' },
      { name: 'Material Science', code: 'ME3041', credits: 4, grade: 'A', score: '81' },
      { name: 'Machine Shop Practice', code: 'ME3032', credits: 2, grade: 'A', score: '84' }
    ];
  } else {
    // Computer Science (Default)
    gradesData = [
      { name: 'Computer networks', code: 'CS3081', credits: 4, grade: 'A', score: '85' },
      { name: 'Software engineering', code: 'CS3041', credits: 3, grade: 'A+', score: '90' },
      { name: 'Database systems', code: 'CS3051', credits: 4, grade: 'B+', score: '78' },
      { name: 'Network & SE Lab', code: 'CS3082', credits: 2, grade: 'O', score: '97' },
      { name: 'Theory of computation', code: 'CS3061', credits: 4, grade: 'A+', score: '93' },
      { name: 'DBMS & Projects Lab', code: 'CS3052', credits: 2, grade: 'A', score: '82' }
    ];
  }

  /* ─────────────────────────────────────────────
     2. RENDER SGPA HISTORICAL BAR CHART
  ───────────────────────────────────────────── */
  var chartContainer = document.getElementById('gpaChart');
  if (chartContainer) {
    chartContainer.innerHTML = sgpaHistory.map(function (sgpa, i) {
      // Proportional height mapping (e.g. 10.0 scale mapped to 140px max height)
      var heightPx = Math.round((sgpa / 10.0) * 130);
      var barStyle = 'height:' + heightPx + 'px;';
      if (sgpa >= 9.0) {
        barStyle += 'background:var(--clr-success);';
      } else if (sgpa < 8.0) {
        barStyle += 'background:var(--clr-warning);';
      }

      return (
        '<div class="chart-col">' +
          '<div class="chart-bar-wrap">' +
            '<div class="chart-bar" style="' + barStyle + '">' +
              '<span class="chart-bar-val">' + sgpa.toFixed(2) + '</span>' +
            '</div>' +
          '</div>' +
          '<span class="chart-label">Sem ' + (i + 1) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  /* ─────────────────────────────────────────────
     3. RENDER LATEST SUBJECT GRADES TABLE
  ───────────────────────────────────────────── */
  var gradesBody = document.getElementById('gradesTableBody');
  var cgpaValue = document.getElementById('cgpaValue');

  if (cgpaValue) cgpaValue.textContent = 'CGPA: ' + user.cgpa;

  if (gradesBody) {
    gradesBody.innerHTML = gradesData.map(function (row) {
      var badgeClass = 'grade-badge';
      var g = row.grade.toUpperCase();
      if (g === 'O' || g === 'A+') badgeClass += ' a-plus';
      else if (g === 'A') badgeClass += ' a';
      else if (g === 'B+') badgeClass += ' b-plus';
      else badgeClass += ' b';

      return (
        '<tr>' +
          '<td>' +
            '<span style="font-weight:700;color:var(--clr-text-2);display:block;">' + esc(row.name) + '</span>' +
            '<span style="font-size:0.675rem;color:var(--clr-muted);">' + esc(row.code) + '</span>' +
          '</td>' +
          '<td>' + row.credits + '</td>' +
          '<td><span class="' + badgeClass + '">' + row.grade + '</span></td>' +
          '<td style="font-weight:600;color:var(--clr-text-2);">' + row.score + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  /* ─────────────────────────────────────────────
     4. CGPA TARGET CALCULATOR LOGIC
  ───────────────────────────────────────────── */
  var btnCalculate = document.getElementById('btnEstimateSgpa');
  var inputTarget = document.getElementById('targetCgpa');
  var resultBox = document.getElementById('estimateResult');

  if (btnCalculate && resultBox && inputTarget) {
    btnCalculate.addEventListener('click', function () {
      var targetVal = parseFloat(inputTarget.value);

      if (isNaN(targetVal) || targetVal < 4.0 || targetVal > 10.0) {
        resultBox.textContent = 'Please enter a valid target CGPA between 4.0 and 10.0.';
        resultBox.style.borderLeftColor = 'var(--clr-danger)';
        return;
      }

      // We have completed 5 semesters. The target is for Sem 6 (6 semesters total).
      // Target_CGPA = (Sum_Sem_1_to_5_SGPA + Sem_6_SGPA) / 6
      // Sem_6_SGPA = (Target_CGPA * 6) - Sum_Sem_1_to_5_SGPA
      var sumSgpa = 0;
      sgpaHistory.forEach(function (val) {
        sumSgpa += val;
      });

      var requiredSgpa = (targetVal * 6) - sumSgpa;

      if (requiredSgpa > 10.0) {
        resultBox.textContent = 'Impossible! To achieve a CGPA of ' + targetVal.toFixed(2) + ', you would need an SGPA of ' + requiredSgpa.toFixed(2) + ' in Semester 6 (max possible is 10.0).';
        resultBox.style.borderLeftColor = 'var(--clr-danger)';
      } else if (requiredSgpa < 4.0) {
        resultBox.textContent = 'You will easily achieve your target. You need an SGPA of ' + Math.max(requiredSgpa, 4.0).toFixed(2) + ' or above in Semester 6.';
        resultBox.style.borderLeftColor = 'var(--clr-success)';
      } else {
        resultBox.textContent = 'You need to score an SGPA of ' + requiredSgpa.toFixed(2) + ' or higher in Semester 6 to hit a CGPA of ' + targetVal.toFixed(2) + '.';
        resultBox.style.borderLeftColor = 'var(--clr-primary)';
      }
    });
  }

  function esc(val) {
    if (val === undefined || val === null) return '';
    return String(val)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

}());
