/**
 * StudentSphere – Student Internships Desk Logic
 * File: internshipsStudent.js
 */

(function () {
  'use strict';

  if (!window.StudentSphere || !window.StudentSphere.user) {
    return;
  }

  var user = window.StudentSphere.user;
  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('internships');

  /* ─────────────────────────────────────────────
     1. OPPORTUNITIES DATABASE
  ───────────────────────────────────────────── */
  var branch = (user.branch || '').toLowerCase();
  var myBranchKey = 'cs';
  if (branch.includes('communication') || branch.includes('electronics')) {
    myBranchKey = 'ece';
  } else if (branch.includes('mechanical')) {
    myBranchKey = 'mechanical';
  }

  var opportunities = [
    {
      id: 1,
      role: 'Software Engineering Intern',
      company: 'Google India',
      logo: 'G',
      location: 'Bangalore, India (Hybrid)',
      remote: false,
      stipend: '\u20b950,000/mo',
      branch: 'cs',
      desc: 'Work with engineering teams on core cloud infrastructure, indexing pipelines, or web applications. Strong algorithms & coding skills required.',
      applied: false
    },
    {
      id: 2,
      role: 'React Full-Stack Web Intern',
      company: 'Stripe',
      logo: 'S',
      location: 'Remote (Global)',
      remote: true,
      stipend: '\u20b945,000/mo',
      branch: 'cs',
      desc: 'Build dashboard widgets and checkout flows using React, TypeScript, and Node.js. Join a fully remote international development team.',
      applied: false
    },
    {
      id: 3,
      role: 'Silicon VLSI Design Intern',
      company: 'Intel Corporation',
      logo: 'I',
      location: 'Bangalore, India (Onsite)',
      remote: false,
      stipend: '\u20b935,000/mo',
      branch: 'ece',
      desc: 'Assist in ASIC layout design, verification scripting, and RTL coding. Familiarity with Verilog and EDA tools is highly desired.',
      applied: false
    },
    {
      id: 4,
      role: 'Signal Processing Analyst',
      company: 'Qualcomm India',
      logo: 'Q',
      location: 'Hyderabad, India (Hybrid)',
      remote: false,
      stipend: '\u20b938,000/mo',
      branch: 'ece',
      desc: 'Collaborate with the 5G modem team to simulate and test signal filters and DSP pipelines. Strong MATLAB background needed.',
      applied: false
    },
    {
      id: 5,
      role: 'Thermal Dynamics Analyst',
      company: 'Tata Motors',
      logo: 'T',
      location: 'Pune, India (Onsite)',
      remote: false,
      stipend: '\u20b922,000/mo',
      branch: 'mechanical',
      desc: 'Analyze heat distribution and airflow dynamics in automotive engines. Experience with ANSYS or thermal simulations is a plus.',
      applied: false
    },
    {
      id: 6,
      role: 'Robotics & CAD Designer',
      company: 'Tesla Automation',
      logo: 'T',
      location: 'Remote (US Hours)',
      remote: true,
      stipend: '\u20b960,000/mo',
      branch: 'mechanical',
      desc: 'Design SolidWorks models for robotic arm grippers and custom actuator housing. Coordinates with local manufacturing units.',
      applied: false
    }
  ];

  var activeFilter = 'all';

  /* ─────────────────────────────────────────────
     2. RENDERING LOGIC
  ───────────────────────────────────────────── */
  var grid = document.getElementById('internshipsGrid');

  function renderOpportunities() {
    if (!grid) return;

    var filtered = opportunities.filter(function (op) {
      if (activeFilter === 'branch') {
        return op.branch === myBranchKey;
      }
      if (activeFilter === 'remote') {
        return op.remote === true;
      }
      return true;
    });

    grid.innerHTML = filtered.map(function (op) {
      var btnText = op.applied ? 'Applied \u2713' : 'Apply Now';
      var btnClass = op.applied ? 'intern-btn applied' : 'intern-btn';
      var locLabel = op.remote ? 'Remote' : 'Onsite';

      return (
        '<div class="intern-card" data-id="' + op.id + '">' +
          '<div class="intern-header">' +
            '<div class="company-logo">' + op.logo + '</div>' +
            '<div class="intern-title-group">' +
              '<span class="intern-role">' + esc(op.role) + '</span>' +
              '<span class="intern-company">' + esc(op.company) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="intern-meta-labels">' +
            '<span class="meta-label">' + esc(op.location) + '</span>' +
            '<span class="meta-label stipend">' + op.stipend + '</span>' +
            '<span class="meta-label">' + op.branch.toUpperCase() + '</span>' +
          '</div>' +
          '<p class="intern-desc">' + esc(op.desc) + '</p>' +
          '<div class="intern-footer">' +
            '<button class="' + btnClass + '" ' + (op.applied ? 'disabled' : '') + '>' + btnText + '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    // Bind Apply clicks
    grid.querySelectorAll('.intern-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.intern-card');
        var id = parseInt(card.getAttribute('data-id'), 10);
        handleApply(id);
      });
    });
  }

  function handleApply(id) {
    for (var i = 0; i < opportunities.length; i++) {
      if (opportunities[i].id === id) {
        var op = opportunities[i];
        if (op.applied) return;

        op.applied = true;
        showToast('Application sent successfully to ' + op.company + '!', 'success', 3000);
        renderOpportunities();
        return;
      }
    }
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

  /* ─────────────────────────────────────────────
     3. FILTER HANDLERS
  ───────────────────────────────────────────── */
  var filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter');
      renderOpportunities();
    });
  });

  // Initial render
  renderOpportunities();

}());
