/**
 * StudentSphere – Student Library Page Logic
 * File: elibraryStudent.js
 */

(function () {
  'use strict';

  if (!window.StudentSphere || !window.StudentSphere.user) {
    return;
  }

  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('elibrary');

  /* ─────────────────────────────────────────────
     1. INITIALIZE BOOK DATABASE
  ───────────────────────────────────────────── */
  var books = [
    { id: 1, title: 'Introduction to Algorithms', author: 'Cormen, Leiserson, Rivest', year: '2009', genre: 'cs', status: 'available', isbn: '978-0262033848' },
    { id: 2, title: 'Computer Networks: A Systems Approach', author: 'Larry Peterson & Bruce Davie', year: '2011', genre: 'cs', status: 'available', isbn: '978-0123850522' },
    { id: 3, title: 'Software Engineering: A Practitioner\'s Approach', author: 'Roger Pressman', year: '2014', genre: 'cs', status: 'issued', isbn: '978-0078022128' },
    { id: 4, title: 'Design Patterns: Elements of Reusable Object-Oriented Software', author: 'Erich Gamma & Richard Helm', year: '1994', genre: 'cs', status: 'available', isbn: '978-0201633610' },
    { id: 5, title: 'Microelectronic Circuits', author: 'Adel Sedra & Kenneth Smith', year: '2019', genre: 'ece', status: 'available', isbn: '978-0190853464' },
    { id: 6, title: 'Principles of Electromagnetics', author: 'Matthew Sadiku', year: '2015', genre: 'ece', status: 'available', isbn: '978-0199461851' },
    { id: 7, title: 'Fundamentals of Thermodynamics', author: 'Claus Borgnakke & Richard Sonntag', year: '2012', genre: 'general', status: 'available', isbn: '978-1118131992' },
    { id: 8, title: 'Advanced Engineering Mathematics', author: 'Erwin Kreyszig', year: '2011', genre: 'maths', status: 'issued', isbn: '978-0470458365' },
    { id: 9, title: 'Calculus: Early Transcendentals', author: 'James Stewart', year: '2015', genre: 'maths', status: 'available', isbn: '978-1285741550' }
  ];

  var activeGenre = 'all';
  var searchQuery = '';

  /* ─────────────────────────────────────────────
     2. RENDERING LOGIC
  ───────────────────────────────────────────── */
  var grid = document.getElementById('libraryGrid');

  function renderBooks() {
    if (!grid) return;

    var filtered = books.filter(function (book) {
      // Genre filter
      if (activeGenre !== 'all' && book.genre !== activeGenre) return false;

      // Search filter
      if (searchQuery) {
        var t = book.title.toLowerCase();
        var a = book.author.toLowerCase();
        var i = book.isbn.toLowerCase();
        return t.includes(searchQuery) || a.includes(searchQuery) || i.includes(searchQuery);
      }

      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="color:var(--clr-muted);text-align:center;grid-column:1/-1;padding:2rem 0;font-size:0.85rem;">No books found in catalogue.</div>';
      return;
    }

    grid.innerHTML = filtered.map(function (book) {
      // Status tags
      var availClass = 'avail-indicator';
      var availText = 'Available';
      var borrowText = 'Request Borrow';
      var borrowDisabled = '';

      if (book.status === 'issued') {
        availClass += ' issued';
        availText = 'Issued';
        borrowText = 'Unavailable';
        borrowDisabled = ' disabled';
      } else if (book.status === 'requested') {
        availClass += ' requested';
        availText = 'Requested';
        borrowText = 'Cancel Request';
      } else {
        availClass += ' available';
      }

      return (
        '<div class="book-card" data-id="' + book.id + '">' +
          '<div class="book-cover-placeholder" style="background:' + getBookColor(book.genre) + ';">' +
            '<span class="genre-tag">' + book.genre + '</span>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
              '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' +
            '</svg>' +
          '</div>' +
          '<div class="book-body">' +
            '<span class="book-title">' + esc(book.title) + '</span>' +
            '<span class="book-author">' + esc(book.author) + '</span>' +
            '<div class="book-meta">' +
              '<span>' + book.year + '</span>' +
              '<span class="' + availClass + '">' + availText + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="book-footer">' +
            '<button class="book-action-btn primary' + borrowDisabled + '" data-action="borrow">' + borrowText + '</button>' +
            '<button class="book-action-btn secondary" data-action="read">Read PDF</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    // Bind Button events
    grid.querySelectorAll('[data-action="borrow"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.book-card');
        var id = parseInt(card.getAttribute('data-id'), 10);
        handleBorrow(id);
      });
    });

    grid.querySelectorAll('[data-action="read"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.book-card');
        var title = card.querySelector('.book-title').textContent;
        showToast('Opening virtual reader for: ' + title, 'info', 2500);
      });
    });
  }

  function handleBorrow(id) {
    for (var i = 0; i < books.length; i++) {
      if (books[i].id === id) {
        var book = books[i];
        if (book.status === 'issued') return;

        if (book.status === 'requested') {
          book.status = 'available';
          showToast('Request for "' + book.title + '" cancelled.', 'default', 2500);
        } else {
          book.status = 'requested';
          showToast('Borrow requested! Collect from college library within 48h.', 'success', 3500);
        }
        renderBooks();
        return;
      }
    }
  }

  function getBookColor(genre) {
    if (genre === 'cs') return 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
    if (genre === 'ece') return 'linear-gradient(135deg, #581c87 0%, #a855f7 100%)';
    if (genre === 'maths') return 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)';
    return 'linear-gradient(135deg, #475569 0%, #64748b 100%)';
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
     3. FILTER & SEARCH HANDLERS
  ───────────────────────────────────────────── */
  var filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeGenre = btn.getAttribute('data-genre');
      renderBooks();
    });
  });

  var searchInput = document.getElementById('libSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      searchQuery = searchInput.value.trim().toLowerCase();
      renderBooks();
    });
  }

  // Initial Load
  renderBooks();

}());
