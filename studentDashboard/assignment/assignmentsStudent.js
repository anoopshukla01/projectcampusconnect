/**
 * StudentSphere – Student Assignments Page Logic
 * File: assignmentsStudent.js
 */

(function () {
  'use strict';

  if (!window.StudentSphere || !window.StudentSphere.user) {
    return;
  }

  var user = window.StudentSphere.user;
  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('assignments');

  /* ─────────────────────────────────────────────
     1. PARSE / FETCH ASSIGNMENTS FROM USER SESSION
  ───────────────────────────────────────────── */
  var assignments = user.assignments || [];
  
  // Ensure every assignment has a status, points, and instructions if missing
  var defaultSpec = {
    'Process scheduling simulation': {
      status: 'pending', points: '100 pts',
      desc: 'Complete the process scheduling simulation script in Python/C++ implementing FIFO, SJF, and Round Robin algorithms. Submit a zip containing your code and a detailed report in PDF.',
      attachment: 'spec_scheduling_v2.pdf'
    },
    'TCP congestion control report': {
      status: 'pending', points: '50 pts',
      desc: 'Analyze TCP Reno, Tahoe, and BBR congestion window graphs under simulated network conditions. Write a report detailing how packet drop events and RTT affect the window size.',
      attachment: 'congestion_traces.txt'
    },
    'Turing machine construction': {
      status: 'submitted', points: '80 pts',
      desc: 'Design a Turing Machine that accepts the language L = {a^n b^n c^n | n >= 0}. Provide transition tables, state diagrams, and a short trace file.',
      attachment: 'turing_template.jff'
    },
    'VLSI Full Adder Layout': {
      status: 'pending', points: '100 pts',
      desc: 'Create a full CMOS layout of a 1-bit full adder using Microwind/Dsch. Perform DRC checks and run simulation to extract propagation delay parameters.',
      attachment: 'adder_rules.drc'
    },
    'Carnot cycle analysis report': {
      status: 'pending', points: '60 pts',
      desc: 'Plot P-V and T-S diagrams for an ideal Carnot cycle. Calculate thermal efficiency for reservoir temperatures of 300K and 800K.',
      attachment: 'carnot_template.xlsx'
    },
    'Pipe flow simulation': {
      status: 'submitted', points: '100 pts',
      desc: 'Simulate laminar and turbulent water flow in a pipe using ANSYS Fluent. Compare numerical velocity profiles with analytical Hagen-Poiseuille results.',
      attachment: 'mesh_pipe.msh'
    },
    'CAD model of gear assembly': {
      status: 'graded', points: '80 pts',
      desc: 'Model a spur gear box assembly with 1:4 reduction ratio in SolidWorks. Verify tooth interference and generate assembly sheets in PDF.',
      attachment: 'gear_dimensions.pdf',
      grade: '76 / 80',
      feedback: 'Excellent tolerances and gear mating. Render animations were highly detailed and complete.'
    },
    'Stress analysis using FEM': {
      status: 'pending', points: '50 pts',
      desc: 'Apply finite element methods to analyze shear stress distribution in a cantilever beam under concentrated tip load. Cross-verify with analytical beam bending formulas.',
      attachment: 'cantilever_setup.db'
    },
    'SVM classification project': {
      status: 'pending', points: '100 pts',
      desc: 'Implement a Support Vector Machine classifier using scikit-learn. Tune hyperparameters (C, gamma, kernel) to optimize classification metrics on the MNIST dataset.',
      attachment: 'mnist_subset.csv'
    },
    'AWS deployment report': {
      status: 'graded', points: '100 pts',
      desc: 'Configure an auto-scaling group with ELB and RDS on AWS. Document your setup, traffic routing rules, and scaling triggers in a structured report.',
      attachment: 'aws_lab_spec.pdf',
      grade: '95 / 100',
      feedback: 'Perfect execution of auto-scaling under Apache Bench stress tests. Security group configurations were properly segmented.'
    },
    'ER Diagram for inventory system': {
      status: 'graded', points: '50 pts',
      desc: 'Draw a complete Entity-Relationship diagram for a multi-vendor warehouse management system. Document cardinality, attributes, and key constraints.',
      attachment: 'inventory_reqs.txt',
      grade: '46 / 50',
      feedback: 'Well thought out tables. Missed a few composite keys on the shipment details mapping.'
    },
    'OS scheduler simulation': {
      status: 'pending', points: '100 pts',
      desc: 'Simulate CPU and I/O bound process scheduling algorithms in Python. Generate average waiting time charts for different scheduling policies.',
      attachment: 'scheduling_api.py'
    }
  };

  // Hydrate assignments array
  assignments.forEach(function (a) {
    var spec = defaultSpec[a.name] || { status: 'pending', points: '100 pts', desc: 'No details available.', attachment: 'spec.pdf' };
    a.status = a.status || spec.status;
    a.points = a.points || spec.points;
    a.desc = a.desc || spec.desc;
    a.attachment = a.attachment || spec.attachment;
    a.grade = a.grade || spec.grade;
    a.feedback = a.feedback || spec.feedback;
  });

  var selectedAssignment = null;
  var activeFilter = 'all';

  /* ─────────────────────────────────────────────
     2. DOM ELEMENTS
  ───────────────────────────────────────────── */
  var listContainer = document.getElementById('assignCardsList');
  var emptyDetailState = document.getElementById('emptyDetailState');
  var detailContent = document.getElementById('detailContent');

  var detailSubject = document.getElementById('detailSubject');
  var detailTitle = document.getElementById('detailTitle');
  var detailStatusBadge = document.getElementById('detailStatusBadge');
  var detailPoints = document.getElementById('detailPoints');
  var detailInstructions = document.getElementById('detailInstructions');
  var attachmentSection = document.getElementById('attachmentSection');
  var attachmentName = document.getElementById('attachmentName');
  var gradedSection = document.getElementById('gradedSection');
  var gradeScore = document.getElementById('gradeScore');
  var gradeComment = document.getElementById('gradeComment');
  var submitSection = document.getElementById('submitSection');

  var dropZone = document.getElementById('dropZone');
  var fileInput = document.getElementById('fileInput');
  var dropText = document.getElementById('dropText');
  var submitForm = document.getElementById('submitForm');

  /* ─────────────────────────────────────────────
     3. RENDER ASSIGNMENT LIST
  ───────────────────────────────────────────── */
  function renderList() {
    if (!listContainer) return;

    var filtered = assignments.filter(function (a) {
      if (activeFilter === 'all') return true;
      return a.status === activeFilter;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = '<li style="text-align:center;color:var(--clr-muted);padding:2rem 0;font-size:0.85rem;">No assignments match the filter.</li>';
      return;
    }

    listContainer.innerHTML = filtered.map(function (a) {
      var badgeClass = 'status-badge';
      if (a.status === 'graded') badgeClass += ' safe';
      else if (a.status === 'submitted') badgeClass += ' warning';
      else badgeClass += ' critical';

      var selectClass = (selectedAssignment && selectedAssignment.name === a.name) ? ' selected' : '';

      return (
        '<li class="assign-card' + selectClass + '" data-name="' + encodeURIComponent(a.name) + '">' +
          '<div class="card-subject-row">' +
            '<span class="card-subject">' + esc(a.subject) + '</span>' +
            '<span class="' + badgeClass + '">' + esc(a.status) + '</span>' +
          '</div>' +
          '<span class="card-title">' + esc(a.name) + '</span>' +
          '<div class="card-due-row">' +
            '<span class="card-due">' + esc(a.due) + '</span>' +
            '<span style="font-weight:600;color:var(--clr-muted);">' + esc(a.points) + '</span>' +
          '</div>' +
        '</li>'
      );
    }).join('');

    // Bind card clicks
    var cards = listContainer.querySelectorAll('.assign-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        var name = decodeURIComponent(card.getAttribute('data-name'));
        selectAssignmentByName(name);
      });
    });
  }

  function selectAssignmentByName(name) {
    for (var i = 0; i < assignments.length; i++) {
      if (assignments[i].name === name) {
        selectedAssignment = assignments[i];
        break;
      }
    }
    renderList();
    renderDetails();
  }

  /* ─────────────────────────────────────────────
     4. RENDER ASSIGNMENT DETAILS
  ───────────────────────────────────────────── */
  function renderDetails() {
    if (!selectedAssignment) {
      emptyDetailState.classList.remove('hidden');
      detailContent.classList.add('hidden');
      return;
    }

    emptyDetailState.classList.add('hidden');
    detailContent.classList.remove('hidden');

    detailSubject.textContent = selectedAssignment.subject;
    detailTitle.textContent = selectedAssignment.name;
    detailPoints.textContent = selectedAssignment.points;
    detailInstructions.textContent = selectedAssignment.desc;

    // Status Badge
    detailStatusBadge.textContent = selectedAssignment.status;
    detailStatusBadge.className = 'status-badge';
    if (selectedAssignment.status === 'graded') detailStatusBadge.classList.add('safe');
    else if (selectedAssignment.status === 'submitted') detailStatusBadge.classList.add('warning');
    else detailStatusBadge.classList.add('critical');

    // Resource Attachments
    if (selectedAssignment.attachment) {
      attachmentSection.classList.remove('hidden');
      attachmentName.textContent = selectedAssignment.attachment;
    } else {
      attachmentSection.classList.add('hidden');
    }

    // Reset upload status texts
    dropText.textContent = 'Drag and drop file here or click to browse';
    fileInput.value = '';

    // Show sections dynamically depending on status
    if (selectedAssignment.status === 'graded') {
      gradedSection.classList.remove('hidden');
      submitSection.classList.add('hidden');
      if (gradeScore) gradeScore.textContent = selectedAssignment.grade;
      if (gradeComment) gradeComment.textContent = selectedAssignment.feedback;
    } else if (selectedAssignment.status === 'submitted') {
      gradedSection.classList.add('hidden');
      submitSection.classList.remove('hidden');
      dropText.textContent = 'File already uploaded. Click/drop to replace.';
      var btnSubmit = submitSection.querySelector('.submit-btn');
      if (btnSubmit) btnSubmit.textContent = 'Resubmit Work';
    } else {
      // Pending
      gradedSection.classList.add('hidden');
      submitSection.classList.remove('hidden');
      var btnSubmit2 = submitSection.querySelector('.submit-btn');
      if (btnSubmit2) btnSubmit2.textContent = 'Submit Assignment';
    }
  }

  /* ─────────────────────────────────────────────
     5. FILE UPLOAD & FORM ACTIONS
  ───────────────────────────────────────────── */
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', function () {
      fileInput.click();
    });

    fileInput.addEventListener('change', function () {
      if (fileInput.files.length > 0) {
        dropText.textContent = 'Selected: ' + fileInput.files[0].name;
      }
    });

    dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', function () {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        dropText.textContent = 'Selected: ' + fileInput.files[0].name;
      }
    });
  }

  if (submitForm) {
    submitForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!selectedAssignment) return;

      if (!fileInput.files.length && selectedAssignment.status === 'pending') {
        showToast('Please select a file to submit!', 'info', 2000);
        return;
      }

      var fileName = fileInput.files.length ? fileInput.files[0].name : 'submission.zip';

      selectedAssignment.status = 'submitted';
      
      // Update session counts and write back to localStorage
      var pendingCount = 0;
      assignments.forEach(function (a) {
        if (a.status === 'pending') pendingCount++;
      });
      user.pendingTasks = pendingCount;
      user.assignments = assignments;
      localStorage.setItem('ss_user', JSON.stringify(user));

      // Refresh headers
      window.StudentSphere.populateHeader();

      showToast('Successfully submitted ' + fileName + '!', 'success', 3500);

      renderList();
      renderDetails();
    });
  }

  /* ─────────────────────────────────────────────
     6. FILTER CHIPS
  ───────────────────────────────────────────── */
  var filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter');
      renderList();
    });
  });

  function esc(val) {
    if (val === undefined || val === null) return '';
    return String(val)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  // Initial Load
  renderList();

}());
