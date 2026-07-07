/**
 * StudentSphere – Student Lost and Found Desk Logic
 * File: lostandfoundStudent.js
 */

(function () {
  'use strict';

  if (!window.StudentSphere || !window.StudentSphere.user) {
    return;
  }

  var user = window.StudentSphere.user;
  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('lostandfound');

  /* ─────────────────────────────────────────────
     1. INITIALIZE DATA DATABASE
  ───────────────────────────────────────────── */
  var items = [
    {
      id: 1,
      title: 'Black Leather Wallet',
      type: 'lost',
      location: 'Library Cafeteria seating area',
      contact: '9876543210',
      date: 'Nov 24, 2026',
      desc: 'Contains student ID card, bus pass, and some cash. Please return if found.'
    },
    {
      id: 2,
      title: 'Red Mi Smart Band 6',
      type: 'found',
      location: 'Lecture Hall 102 (LH-102) under desk 12',
      contact: '9908877665',
      date: 'Nov 23, 2026',
      desc: 'Found during afternoon slot. Black strap is slightly scratched. Handed over to block coordinator.'
    },
    {
      id: 3,
      title: 'Ray-Ban Aviation Sunglasses',
      type: 'lost',
      location: 'Basketball Court benches',
      contact: '9554433221',
      date: 'Nov 22, 2026',
      desc: 'Silver metal frame, green polarized lenses. Lost during matches.'
    },
    {
      id: 4,
      title: 'Bunch of Keys with Blue Ribbon Tag',
      type: 'found',
      location: 'Ground Floor Academic Block corridors',
      contact: '9812345670',
      date: 'Nov 20, 2026',
      desc: '3 keys altogether on a ring with a blue ribbon saying "Always Curious".'
    }
  ];

  var activeTypeFilter = 'all';

  /* ─────────────────────────────────────────────
     2. RENDER CARD LOGIC
  ───────────────────────────────────────────── */
  var grid = document.getElementById('deskGrid');

  function renderItems() {
    if (!grid) return;

    var filtered = items.filter(function (item) {
      if (activeTypeFilter === 'all') return true;
      return item.type === activeTypeFilter;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="color:var(--clr-muted);text-align:center;grid-column:1/-1;padding:3rem 0;font-size:0.85rem;">No reported logs found. Thank you for keeping campus clean!</div>';
      return;
    }

    grid.innerHTML = filtered.map(function (item) {
      var isLost = item.type === 'lost';
      var bannerClass = isLost ? 'desk-banner' : 'desk-banner found';
      var badgeText = isLost ? 'Lost' : 'Found';
      var btnText = isLost ? 'I Found This' : 'Claim Item';
      var iconMarkup = isLost ? 
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' :
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';

      return (
        '<div class="desk-card" data-id="' + item.id + '">' +
          '<div class="' + bannerClass + '">' +
            '<span class="desk-status-badge">' + badgeText + '</span>' +
            iconMarkup +
          '</div>' +
          '<div class="desk-body">' +
            '<h3 class="desk-title">' + esc(item.title) + '</h3>' +
            '<p class="desk-desc">' + esc(item.desc) + '</p>' +
            '<div class="desk-details">' +
              '<div class="desk-detail-item">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                '<span>' + esc(item.location) + '</span>' +
              '</div>' +
              '<div class="desk-detail-item">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
                '<span>' + esc(item.date) + '</span>' +
              '</div>' +
              '<div class="desk-detail-item" style="color:var(--clr-primary-dark);font-weight:600;">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' +
                '<span>' + esc(item.contact) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="desk-footer">' +
            '<button class="desk-btn">' + btnText + '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    // Bind footer action click
    grid.querySelectorAll('.desk-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.desk-card');
        var id = parseInt(card.getAttribute('data-id'), 10);
        handleClaim(id);
      });
    });
  }

  function handleClaim(id) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        var item = items[i];
        showToast('Initiated claim ticket! Alert request sent to ' + item.contact + ' for: ' + item.title, 'success', 4000);
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
     3. FILTERS & EVENT BINDINGS
  ───────────────────────────────────────────── */
  var filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeTypeFilter = btn.getAttribute('data-type');
      renderItems();
    });
  });

  /* ─────────────────────────────────────────────
     4. MODAL HANDLERS
  ───────────────────────────────────────────── */
  var modal = document.getElementById('reportModalOverlay');
  var openModalBtn = document.getElementById('openReportModalBtn');
  var closeModalBtn = document.getElementById('closeModalBtn');
  var cancelModalBtn = document.getElementById('cancelModalBtn');
  var reportForm = document.getElementById('reportItemForm');

  if (openModalBtn && modal) {
    openModalBtn.addEventListener('click', function () {
      modal.classList.add('active');
    });
  }

  function hideModal() {
    if (modal) {
      modal.classList.remove('active');
    }
    if (reportForm) {
      reportForm.reset();
    }
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', hideModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', hideModal);

  if (reportForm) {
    reportForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var title = document.getElementById('reportTitle').value.trim();
      var type = document.getElementById('reportType').value;
      var location = document.getElementById('reportLocation').value.trim();
      var contact = document.getElementById('reportContact').value.trim();
      var desc = document.getElementById('reportDesc').value.trim();

      if (!title || !location || !contact || !desc) {
        showToast('Please fill all mandatory item details.', 'error', 3000);
        return;
      }

      // Generate date text
      var dateObj = new Date();
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var dateStr = months[dateObj.getMonth()] + ' ' + dateObj.getDate() + ', ' + dateObj.getFullYear();

      var newItem = {
        id: items.length + 1,
        title: title,
        type: type,
        location: location,
        contact: contact,
        date: dateStr,
        desc: desc
      };

      items.unshift(newItem); // Add to top
      hideModal();
      showToast('Item report logged successfully!', 'success', 3000);
      renderItems();
    });
  }

  // Initial render
  renderItems();

}());
