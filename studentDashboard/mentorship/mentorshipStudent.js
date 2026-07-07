/**
 * StudentSphere – Student Mentorship Desk Logic
 * File: mentorshipStudent.js
 */

(function () {
  'use strict';

  if (!window.StudentSphere || !window.StudentSphere.user) {
    return;
  }

  var user = window.StudentSphere.user;
  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('mentorship');

  /* ─────────────────────────────────────────────
     1. FACULTY DATABASE
  ───────────────────────────────────────────── */
  var branch = (user.branch || '').toLowerCase();
  var myBranchKey = 'cs';
  if (branch.includes('communication') || branch.includes('electronics')) {
    myBranchKey = 'ece';
  } else if (branch.includes('mechanical')) {
    myBranchKey = 'mechanical';
  }

  var professors = [
    {
      id: 1,
      name: 'Dr. Sneha Patel',
      dept: 'Computer Science',
      branch: 'cs',
      research: 'Machine Learning & Cyber-physical systems',
      email: 'sneha.patel@vitstudent.ac.in',
      slots: 'available',
      requested: false
    },
    {
      id: 2,
      name: 'Dr. Vikram Singh',
      dept: 'Computer Science',
      branch: 'cs',
      research: 'Cloud Computing & Distributed Algorithms',
      email: 'vikram.singh@vitstudent.ac.in',
      slots: 'full',
      requested: false
    },
    {
      id: 3,
      name: 'Dr. Suresh Babu',
      dept: 'Electronics & Comm.',
      branch: 'ece',
      research: 'ASIC Design & Low Power VLSI Architectures',
      email: 'suresh.babu@vitstudent.ac.in',
      slots: 'available',
      requested: false
    },
    {
      id: 4,
      name: 'Dr. Kavitha Menon',
      dept: 'Electronics & Comm.',
      branch: 'ece',
      research: 'Wireless communications & Waveguides',
      email: 'kavitha.menon@vitstudent.ac.in',
      slots: 'available',
      requested: false
    },
    {
      id: 5,
      name: 'Dr. Ramesh Kumar',
      dept: 'Mechanical Engineering',
      branch: 'mechanical',
      research: 'Thermodynamics & IC Engine efficiency',
      email: 'ramesh.kumar@vitstudent.ac.in',
      slots: 'available',
      requested: false
    },
    {
      id: 6,
      name: 'Dr. Anil Sharma',
      dept: 'Mechanical Engineering',
      branch: 'mechanical',
      research: 'Kinematics & Robotics Automation',
      email: 'anil.sharma@vitstudent.ac.in',
      slots: 'full',
      requested: false
    }
  ];

  var activeFilter = 'all';

  /* ─────────────────────────────────────────────
     2. RENDERING LOGIC
  ───────────────────────────────────────────── */
  var grid = document.getElementById('mentorGrid');

  function renderProfessors() {
    if (!grid) return;

    var filtered = professors.filter(function (p) {
      if (activeFilter === 'matching') {
        return p.branch === myBranchKey;
      }
      return true;
    });

    grid.innerHTML = filtered.map(function (p) {
      var initials = p.name.split(' ').slice(1).map(function(n){ return n[0]; }).join('').toUpperCase();
      if (!initials) initials = p.name.slice(0, 2).toUpperCase();

      var isFull = p.slots === 'full';
      var slotsClass = isFull ? 'mentor-slots full' : 'mentor-slots available';
      var slotsText = isFull ? 'Slots Full' : 'Accepting Requests';

      var btnText = 'Request Mentorship';
      var btnClass = 'mentor-btn';
      var btnDisabled = '';

      if (p.requested) {
        btnText = 'Requested \u2713';
        btnClass += ' requested';
        btnDisabled = 'disabled';
      } else if (isFull) {
        btnText = 'No Slots Available';
        btnClass += ' full';
        btnDisabled = 'disabled';
      }

      return (
        '<div class="mentor-card" data-id="' + p.id + '">' +
          '<div class="mentor-header">' +
            '<div class="mentor-avatar">' + initials + '</div>' +
            '<div class="mentor-title-group">' +
              '<span class="mentor-name">' + esc(p.name) + '</span>' +
              '<span class="mentor-dept">' + esc(p.dept) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="mentor-body">' +
            '<div class="mentor-info-item">' +
              '<span class="mentor-label">Research Area</span>' +
              '<span class="mentor-value">' + esc(p.research) + '</span>' +
            '</div>' +
            '<div class="mentor-info-item">' +
              '<span class="mentor-label">Email contact</span>' +
              '<span class="mentor-value" style="font-size:0.7rem;color:var(--clr-primary);">' + esc(p.email) + '</span>' +
            '</div>' +
            '<div class="mentor-info-item" style="margin-top:0.25rem;">' +
              '<span class="' + slotsClass + '">' + slotsText + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="mentor-footer">' +
            '<button class="' + btnClass + '" ' + btnDisabled + '>' + btnText + '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    // Bind Request click
    grid.querySelectorAll('.mentor-btn').forEach(function (btn) {
      if (btn.disabled) return;
      btn.addEventListener('click', function () {
        var card = btn.closest('.mentor-card');
        var id = parseInt(card.getAttribute('data-id'), 10);
        openRequestModal(id);
      });
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

  /* ─────────────────────────────────────────────
     3. FILTERS BINDING
  ───────────────────────────────────────────── */
  var filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter');
      renderProfessors();
    });
  });

  /* ─────────────────────────────────────────────
     4. REQUEST MODAL CONTROLLER
  ───────────────────────────────────────────── */
  var modal = document.getElementById('mentorModalOverlay');
  var closeModalBtn = document.getElementById('closeModalBtn');
  var cancelModalBtn = document.getElementById('cancelModalBtn');
  var requestForm = document.getElementById('mentorRequestForm');
  var targetInput = document.getElementById('targetMentorId');

  function openRequestModal(id) {
    if (modal && targetInput) {
      targetInput.value = id;
      modal.classList.add('active');
    }
  }

  function hideModal() {
    if (modal) modal.classList.remove('active');
    if (requestForm) requestForm.reset();
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', hideModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', hideModal);

  if (requestForm) {
    requestForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var mentorId = parseInt(targetInput.value, 10);
      var goal = document.getElementById('mentorGoal').value.trim();
      var message = document.getElementById('mentorMessage').value.trim();

      if (!goal || !message) {
        showToast('Please fill out all request parameters.', 'error', 3000);
        return;
      }

      // Update professor status
      for (var i = 0; i < professors.length; i++) {
        if (professors[i].id === mentorId) {
          professors[i].requested = true;
          showToast('Mentorship request sent to ' + professors[i].name + '!', 'success', 3500);
          break;
        }
      }

      hideModal();
      renderProfessors();
    });
  }

  // Initial render
  renderProfessors();

}());
