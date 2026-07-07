/**
 * StudentSphere – Student Events Portal Logic
 * File: eventsStudent.js
 */

(function () {
  'use strict';

  if (!window.StudentSphere || !window.StudentSphere.user) {
    return;
  }

  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('events');

  /* ─────────────────────────────────────────────
     1. EVENT DATABASE
  ───────────────────────────────────────────── */
  var eventsData = [
    {
      id: 1,
      title: 'Hackathon Hyperion 4.0',
      organizer: 'E-CELL & INNOVATION HUB',
      date: 'Dec 04 - 05, 2026',
      time: '09:00 AM onwards',
      location: 'Central Computing Lab-2',
      category: 'hackathon',
      registered: false,
      spots: '12 teams remaining'
    },
    {
      id: 2,
      title: 'TechSpark 2026: Annual Technical Fest',
      organizer: 'STUDENT ACADEMIC COUNCIL',
      date: 'Dec 08 - 10, 2026',
      time: '10:00 AM - 06:00 PM',
      location: 'Main Campus Auditorium & Grounds',
      category: 'fest',
      registered: false,
      spots: 'Public Entry'
    },
    {
      id: 3,
      title: 'Deep Learning & NLP Masterclass',
      organizer: 'DEPARTMENT OF COMPUTER SCIENCE',
      date: 'Nov 29, 2026',
      time: '11:00 AM - 02:00 PM',
      location: 'Lecture Hall 201 (LH-201)',
      category: 'workshop',
      registered: false,
      spots: '45/80 seats filled'
    },
    {
      id: 4,
      title: 'Cultural Odyssey: Fusion Music Night',
      organizer: 'CAMPUS CULTURAL CLUB',
      date: 'Dec 12, 2026',
      time: '06:00 PM - 09:30 PM',
      location: 'Open Air Theatre (OAT)',
      category: 'fest',
      registered: false,
      spots: 'Passes required'
    },
    {
      id: 5,
      title: 'UI/UX Design Sprint & Portfolio Review',
      organizer: 'DESIGN CIRCLE & PEER NETWORK',
      date: 'Dec 02, 2026',
      time: '02:00 PM - 05:00 PM',
      location: 'Seminar Room-3',
      category: 'workshop',
      registered: false,
      spots: '12 seats remaining'
    }
  ];

  var activeCategory = 'all';

  /* ─────────────────────────────────────────────
     2. RENDER EVENTS LOGIC
  ───────────────────────────────────────────── */
  var grid = document.getElementById('eventsGrid');

  function renderEvents() {
    if (!grid) return;

    var filtered = eventsData.filter(function (e) {
      if (activeCategory === 'all') return true;
      return e.category === activeCategory;
    });

    grid.innerHTML = filtered.map(function (e) {
      var bannerClass = 'event-banner';
      if (e.category === 'fest') bannerClass += ' fest';
      if (e.category === 'hackathon') bannerClass += ' hackathon';
      if (e.category === 'workshop') bannerClass += ' workshop';

      var btnText = e.registered ? 'Registered \u2713' : 'Register Now';
      var btnClass = e.registered ? 'event-btn registered' : 'event-btn';

      return (
        '<div class="event-card" data-id="' + e.id + '">' +
          '<div class="' + bannerClass + '">' +
            '<span class="event-category-tag">' + e.category + '</span>' +
            '<svg class="event-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">' +
              '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' +
            '</svg>' +
          '</div>' +
          '<div class="event-body">' +
            '<span class="event-organizer">' + esc(e.organizer) + '</span>' +
            '<h3 class="event-title">' + esc(e.title) + '</h3>' +
            '<div class="events-details">' +
              '<div class="event-detail-item">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
                '<span>' + esc(e.date) + '</span>' +
              '</div>' +
              '<div class="event-detail-item">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
                '<span>' + esc(e.time) + '</span>' +
              '</div>' +
              '<div class="event-detail-item">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                '<span>' + esc(e.location) + '</span>' +
              '</div>' +
              '<div class="event-detail-item" style="color:var(--clr-muted);font-weight:600;margin-top:0.25rem;">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' +
                '<span>' + esc(e.spots) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="event-footer">' +
            '<button class="' + btnClass + '" ' + (e.registered ? 'disabled' : '') + '>' + btnText + '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    // Bind registration clicks
    grid.querySelectorAll('.event-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.event-card');
        var id = parseInt(card.getAttribute('data-id'), 10);
        handleRegister(id);
      });
    });
  }

  function handleRegister(id) {
    for (var i = 0; i < eventsData.length; i++) {
      if (eventsData[i].id === id) {
        var ev = eventsData[i];
        if (ev.registered) return;

        ev.registered = true;
        showToast('Successfully registered for ' + ev.title + '!', 'success', 3000);
        renderEvents();
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
     3. FILTERS & SYNC
  ───────────────────────────────────────────── */
  var filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeCategory = btn.getAttribute('data-category');
      renderEvents();
    });
  });

  var syncBtn = document.getElementById('syncCalendarBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', function () {
      showToast('Synchronizing campus events with Google Calendar\u2026', 'success', 2500);
    });
  }

  // Initial Load
  renderEvents();

}());
