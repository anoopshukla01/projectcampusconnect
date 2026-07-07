/**
 * StudentSphere – Notes & PYQs Page Logic
 * File: notesStudent.js
 */

(function () {
  'use strict';

  if (!window.StudentSphere || !window.StudentSphere.user) {
    return;
  }

  var user = window.StudentSphere.user;
  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('notes');

  /* ─────────────────────────────────────────────
     1. INITIALIZE DATA SETS
  ───────────────────────────────────────────── */
  var branch = (user.branch || '').toLowerCase();
  var subjects = [];

  if (branch.includes('communication') || branch.includes('electronics')) {
    subjects = [
      {
        name: 'Signals & Systems (EC3021)',
        files: [
          { name: 'Lecture 1: Continuous-Time Signals Intro.pdf', size: '2.5 MB', type: 'notes' },
          { name: 'Lecture 2: Fourier Transforms & Analysis.pdf', size: '3.1 MB', type: 'notes' },
          { name: 'Mid-Sem Question Paper 2025.pdf', size: '850 KB', type: 'pyq' },
          { name: 'End-Sem Theory Exam Paper 2024.pdf', size: '1.2 MB', type: 'pyq' }
        ]
      },
      {
        name: 'VLSI Design (EC3031)',
        files: [
          { name: 'CMOS Inverter Design Rules Handout.pdf', size: '1.8 MB', type: 'notes' },
          { name: 'D-Latch and Register Schematics.pdf', size: '2.2 MB', type: 'notes' },
          { name: 'End-Sem Layout exam 2025.pdf', size: '920 KB', type: 'pyq' }
        ]
      },
      {
        name: 'Digital Signal Processing (EC3051)',
        files: [
          { name: 'FIR Filter Design Window Methods.pdf', size: '2.9 MB', type: 'notes' },
          { name: 'DFT & FFT Fast Computations.pdf', size: '3.4 MB', type: 'notes' },
          { name: 'Mid-Sem Question Paper 2025.pdf', size: '780 KB', type: 'pyq' }
        ]
      }
    ];
  } else if (branch.includes('mechanical')) {
    subjects = [
      {
        name: 'Thermodynamics (ME3011)',
        files: [
          { name: 'Carnot Cycles & Heat Engine Efficiency.pdf', size: '2.0 MB', type: 'notes' },
          { name: 'Pure Substance Phase Change Diagrams.pdf', size: '1.7 MB', type: 'notes' },
          { name: 'End-Sem Theory Exam Paper 2024.pdf', size: '1.1 MB', type: 'pyq' }
        ]
      },
      {
        name: 'Fluid Mechanics (ME3021)',
        files: [
          { name: 'Laminar vs Turbulent Boundary Layers.pdf', size: '2.4 MB', type: 'notes' },
          { name: 'Dimensional Analysis & Similitude.pdf', size: '3.0 MB', type: 'notes' },
          { name: 'Mid-Sem Question Paper 2025.pdf', size: '850 KB', type: 'pyq' }
        ]
      },
      {
        name: 'Material Science (ME3041)',
        files: [
          { name: 'Crystal Lattices & Braggs Law.pdf', size: '2.6 MB', type: 'notes' },
          { name: 'Phase Equilibrium & Fe-C Diagrams.pdf', size: '4.1 MB', type: 'notes' },
          { name: 'End-Sem exam 2025.pdf', size: '980 KB', type: 'pyq' }
        ]
      }
    ];
  } else {
    // Computer Science
    subjects = [
      {
        name: 'Computer networks (CS3081)',
        files: [
          { name: 'Lecture 12: IP Subnetting & CIDR Guide.pdf', size: '1.9 MB', type: 'notes' },
          { name: 'Lecture 14: Congestion Control Algorithms.pdf', size: '2.3 MB', type: 'notes' },
          { name: 'Mid-Sem Question Paper 2025.pdf', size: '640 KB', type: 'pyq' },
          { name: 'End-Sem Theory Exam Paper 2024.pdf', size: '1.4 MB', type: 'pyq' }
        ]
      },
      {
        name: 'Software engineering (CS3041)',
        files: [
          { name: 'Scrum Sprint Planning Framework Guide.pdf', size: '1.2 MB', type: 'notes' },
          { name: 'Unified Modeling Language (UML) Diagrams.pdf', size: '2.8 MB', type: 'notes' },
          { name: 'End-Sem Case Studies exam 2025.pdf', size: '1.1 MB', type: 'pyq' }
        ]
      },
      {
        name: 'Database systems (CS3051)',
        files: [
          { name: 'SQL Schema Normalization Guidelines (1NF-BCNF).pdf', size: '2.1 MB', type: 'notes' },
          { name: 'Concurrency Control & ACID Transactions.pdf', size: '1.8 MB', type: 'notes' },
          { name: 'Mid-Sem Question Paper 2025.pdf', size: '720 KB', type: 'pyq' }
        ]
      }
    ];
  }

  var activeTypeFilter = 'all';
  var searchQuery = '';

  /* ─────────────────────────────────────────────
     2. RENDERING FILES
  ───────────────────────────────────────────── */
  var filesContainer = document.getElementById('filesContainer');

  function renderFiles() {
    if (!filesContainer) return;

    var html = '';

    subjects.forEach(function (sub) {
      // Filter files within subject
      var filteredFiles = sub.files.filter(function (file) {
        // Type filter
        if (activeTypeFilter !== 'all' && file.type !== activeTypeFilter) return false;

        // Search filter
        if (searchQuery) {
          var name = file.name.toLowerCase();
          return name.includes(searchQuery);
        }

        return true;
      });

      if (filteredFiles.length === 0) return; // Skip rendering subject if empty

      html += '<section class="subject-section">';
      html += '  <div class="subject-section-header">';
      html += '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
      html += '      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>';
      html += '    </svg>';
      html += '    <h3 class="subject-section-title">' + sub.name + '</h3>';
      html += '  </div>';
      html += '  <div class="files-list">';

      filteredFiles.forEach(function (file) {
        var badgeText = file.type === 'notes' ? 'Notes' : 'PYQ';
        var badgeClass = file.type === 'notes' ? 'file-type-badge' : 'file-type-badge pyq';

        html += '    <div class="file-row">';
        html += '      <div class="file-info-group">';
        html += '        <div class="file-icon-wrap" aria-hidden="true">';
        html += '          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">';
        html += '            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>';
        html += '          </svg>';
        html += '        </div>';
        html += '        <div class="file-text-details">';
        html += '          <span class="file-title" title="' + esc(file.name) + '">' + esc(file.name) + '</span>';
        html += '          <div class="file-meta-sub">';
        html += '            <span>' + file.size + '</span>';
        html += '            <span class="' + badgeClass + '">' + badgeText + '</span>';
        html += '          </div>';
        html += '        </div>';
        html += '      </div>';
        html += '      <button class="file-dl-btn" data-name="' + encodeURIComponent(file.name) + '" aria-label="Download file">';
        html += '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
        html += '          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>';
        html += '        </svg>';
        html += '      </button>';
        html += '    </div>';
      });

      html += '  </div>'; // files-list
      html += '</section>';  // subject-section
    });

    if (html === '') {
      filesContainer.innerHTML = '<div style="color:var(--clr-muted);text-align:center;padding:3rem 0;font-size:0.85rem;">No notes or exam papers match your criteria.</div>';
    } else {
      filesContainer.innerHTML = html;
    }

    // Bind download clicks
    filesContainer.querySelectorAll('.file-dl-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = decodeURIComponent(btn.getAttribute('data-name'));
        showToast('Initiated download: ' + name, 'success', 3000);
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
     3. INTERACTIVE SEARCH & FILTERS
  ───────────────────────────────────────────── */
  var searchInput = document.getElementById('notesSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      searchQuery = searchInput.value.trim().toLowerCase();
      renderFiles();
    });
  }

  var filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeTypeFilter = btn.getAttribute('data-type');
      renderFiles();
    });
  });

  // Initial Load
  renderFiles();

}());
