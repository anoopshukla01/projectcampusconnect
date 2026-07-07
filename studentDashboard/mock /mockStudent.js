/**
 * StudentSphere – Student Mock Interviews Desk Logic
 * File: mockStudent.js
 */

(function () {
  'use strict';

  if (!window.StudentSphere || !window.StudentSphere.user) {
    return;
  }

  var user = window.StudentSphere.user;
  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('mock');

  /* ─────────────────────────────────────────────
     1. INITIALIZE DATA DATABASE
  ───────────────────────────────────────────── */
  var slots = [
    {
      id: 1,
      title: 'Full Stack Coding & Problem Solving',
      interviewer: 'Rohan Sharma',
      initials: 'RS',
      sub: 'Alumni, Amazon SDE-2',
      format: 'technical',
      date: 'Dec 01, 2026',
      timeSlots: ['03:00 PM - 03:45 PM', '04:00 PM - 04:45 PM'],
      booked: false
    },
    {
      id: 2,
      title: 'System Design & Scalability Deep-Dive',
      interviewer: 'Amit Sen',
      initials: 'AS',
      sub: 'Alumni, Uber Staff Engineer',
      format: 'design',
      date: 'Dec 03, 2026',
      timeSlots: ['05:00 PM - 05:45 PM', '06:00 PM - 06:45 PM'],
      booked: false
    },
    {
      id: 3,
      title: 'Behavioral & Leadership Principles',
      interviewer: 'Dr. Vikram Singh',
      initials: 'VS',
      sub: 'CS Faculty Member',
      format: 'behavioral',
      date: 'Nov 30, 2026',
      timeSlots: ['02:00 PM - 02:45 PM', '03:00 PM - 03:45 PM'],
      booked: false
    }
  ];

  var activeFilter = 'all';

  /* ─────────────────────────────────────────────
     2. RENDERING LOGIC
  ───────────────────────────────────────────── */
  var grid = document.getElementById('slotsGrid');

  function renderSlots() {
    if (!grid) return;

    var filtered = slots.filter(function (s) {
      if (activeFilter === 'open') {
        return s.booked === false;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="color:var(--clr-muted);text-align:center;grid-column:1/-1;padding:3rem 0;font-size:0.85rem;">No mock slots found matching this filter.</div>';
      return;
    }

    grid.innerHTML = filtered.map(function (s) {
      var formatClass = 'slot-format-badge';
      if (s.format === 'behavioral') formatClass += ' behavioral';
      if (s.format === 'design') formatClass += ' design';

      var btnText = s.booked ? 'Booked \u2713' : 'Book Session';
      var btnClass = s.booked ? 'slot-btn booked' : 'slot-btn';
      var btnDisabled = s.booked ? 'disabled' : '';

      return (
        '<div class="slot-card" data-id="' + s.id + '">' +
          '<div class="slot-header">' +
            '<span class="' + formatClass + '">' + s.format + '</span>' +
            '<div class="slot-interviewer-initials">' + s.initials + '</div>' +
          '</div>' +
          '<div>' +
            '<h3 class="slot-title">' + esc(s.title) + '</h3>' +
            '<div style="margin-top:0.35rem;">' +
              '<span class="slot-interviewer-info">' + esc(s.interviewer) + '</span>' +
              '<p class="slot-interviewer-sub">' + esc(s.sub) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="slot-details">' +
            '<div class="slot-detail-item">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
              '<span>' + esc(s.date) + '</span>' +
            '</div>' +
            '<div class="slot-detail-item">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
              '<span>' + s.timeSlots[0] + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="slot-footer">' +
            '<button class="' + btnClass + '" ' + btnDisabled + '>' + btnText + '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    // Bind Book click
    grid.querySelectorAll('.slot-btn').forEach(function (btn) {
      if (btn.disabled) return;
      btn.addEventListener('click', function () {
        var card = btn.closest('.slot-card');
        var id = parseInt(card.getAttribute('data-id'), 10);
        openBookingModal(id);
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
      renderSlots();
    });
  });

  /* ─────────────────────────────────────────────
     4. BOOKING MODAL CONTROLLER
  ───────────────────────────────────────────── */
  var modal = document.getElementById('bookingModalOverlay');
  var closeModalBtn = document.getElementById('closeModalBtn');
  var cancelModalBtn = document.getElementById('cancelModalBtn');
  var bookingForm = document.getElementById('bookingForm');
  var targetInput = document.getElementById('targetSlotId');
  var timeSelect = document.getElementById('bookTime');

  function openBookingModal(id) {
    if (modal && targetInput && timeSelect) {
      targetInput.value = id;
      
      // Load slot specific timings
      var slotObj = null;
      for (var i = 0; i < slots.length; i++) {
        if (slots[i].id === id) {
          slotObj = slots[i];
          break;
        }
      }

      if (slotObj) {
        timeSelect.innerHTML = slotObj.timeSlots.map(function (time) {
          return '<option value="' + encodeURIComponent(time) + '">' + time + '</option>';
        }).join('');
      }

      modal.classList.add('active');
    }
  }

  function hideModal() {
    if (modal) modal.classList.remove('active');
    if (bookingForm) bookingForm.reset();
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', hideModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', hideModal);

  if (bookingForm) {
    bookingForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var slotId = parseInt(targetInput.value, 10);
      var selectedTime = decodeURIComponent(timeSelect.value);
      var msg = document.getElementById('bookMessage').value.trim();

      if (!msg) {
        showToast('Please fill out booking preferences.', 'error', 3000);
        return;
      }

      // Update slot booking state
      for (var i = 0; i < slots.length; i++) {
        if (slots[i].id === slotId) {
          slots[i].booked = true;
          showToast('Mock Interview booked at ' + selectedTime + ' with ' + slots[i].interviewer + '!', 'success', 4000);
          break;
        }
      }

      hideModal();
      renderSlots();
    });
  }

  // Initial render
  renderSlots();

}());
