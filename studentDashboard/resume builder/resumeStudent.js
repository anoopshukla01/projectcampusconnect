/**
 * StudentSphere – Student Resume Builder Page Logic
 * File: resumeStudent.js
 */

(function () {
  'use strict';

  if (!window.StudentSphere || !window.StudentSphere.user) {
    return;
  }

  var user = window.StudentSphere.user;
  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('resume');

  /* ─────────────────────────────────────────────
     1. DOM BINDING SELECTORS
  ───────────────────────────────────────────── */
  var inputs = {
    name: document.getElementById('resName'),
    email: document.getElementById('resEmail'),
    phone: document.getElementById('resPhone'),
    github: document.getElementById('resGithub'),
    college: document.getElementById('resCollege'),
    cgpa: document.getElementById('resCgpa'),
    exp: document.getElementById('resExperience'),
    skills: document.getElementById('resSkills')
  };

  var views = {
    name: document.getElementById('viewName'),
    email: document.getElementById('viewEmail'),
    phone: document.getElementById('viewPhone'),
    github: document.getElementById('viewGithub'),
    college: document.getElementById('viewCollege'),
    cgpa: document.getElementById('viewCgpa'),
    exp: document.getElementById('viewExperience'),
    skills: document.getElementById('viewSkills')
  };

  /* ─────────────────────────────────────────────
     2. SYNC LOGIC (REACTIVE INPUTS)
  ───────────────────────────────────────────── */
  function updatePreview() {
    if (views.name) views.name.textContent = inputs.name.value || 'Full Name';
    if (views.email) views.email.textContent = inputs.email.value || 'email@example.com';
    if (views.phone) views.phone.textContent = inputs.phone.value || '98765xxxxx';
    if (views.github) views.github.textContent = inputs.github.value || 'github.com/username';
    if (views.college) views.college.textContent = inputs.college.value || 'Vellore Institute of Technology';
    if (views.cgpa) views.cgpa.textContent = inputs.cgpa.value ? 'CGPA: ' + inputs.cgpa.value : 'CGPA: --';
    if (views.exp) views.exp.textContent = inputs.exp.value || 'Provide experience or project details...';
    if (views.skills) views.skills.textContent = inputs.skills.value || 'Technical skills list...';
  }

  // Bind keyup/input on all fields
  Object.keys(inputs).forEach(function (key) {
    var el = inputs[key];
    if (el) {
      el.addEventListener('input', updatePreview);
    }
  });

  /* ─────────────────────────────────────────────
     3. PREFILL LOGIC (BRANCH SPECIFIC TEMPLATE)
  ───────────────────────────────────────────── */
  var prefillBtn = document.getElementById('btnPrefill');
  if (prefillBtn) {
    prefillBtn.addEventListener('click', function () {
      prefillProfile();
      showToast('Profile data loaded into resume builder template.', 'success', 2500);
    });
  }

  function prefillProfile() {
    var branch = (user.branch || '').toLowerCase();
    
    // Core profile details
    if (inputs.name) inputs.name.value = user.name || 'Ananya';
    if (inputs.email) inputs.email.value = (user.name || 'ananya').toLowerCase() + '@vitstudent.ac.in';
    if (inputs.phone) inputs.phone.value = '9876543210';
    if (inputs.github) inputs.github.value = 'github.com/' + (user.name || 'ananya').toLowerCase() + '20';
    if (inputs.college) inputs.college.value = 'Vellore Institute of Technology';
    if (inputs.cgpa) inputs.cgpa.value = user.cgpa || '8.94';

    // Branch specific projects & skills templates
    var expText = '';
    var skillsText = '';

    if (branch.includes('communication') || branch.includes('electronics')) {
      skillsText = 'Verilog RTL, MATLAB, VHDL, C++, EDA Tools, VLSI Design, Oscilloscope Testing, Arduino';
      expText = 'Project: CMOS High-Frequency Operational Amplifier Design\n' +
                '· Designed a two-stage operational amplifier circuit using 180nm CMOS technology node.\n' +
                '· Simulated frequency response curves achieving a unity-gain bandwidth of 120MHz and 62-degree phase margin.\n' +
                '· Drafted schematic diagrams and verified layouts against DRC and LVS checks using Cadence Virtuoso.';
    } else if (branch.includes('mechanical')) {
      skillsText = 'AutoCAD, SolidWorks, ANSYS Fluent, MATLAB, Finite Element Analysis (FEA), Fluid Dynamics';
      expText = 'Project: Formula Student racecar chassis design optimization\n' +
                '· Modeled space-frame steel tube chassis structures in SolidWorks assembly files.\n' +
                '· Conducted static torsional stiffness simulations in ANSYS Mechanical, reducing vehicle body mass by 14%.\n' +
                '· Collaborated with manufacturing team members to weld and build physical test rigs for chassis load limits.';
    } else {
      // Computer Science (Default)
      skillsText = 'JavaScript (ES6), React.js, Node.js, Express, PostgreSQL, Git, Python, REST APIs, HTML/CSS';
      expText = 'Project: StudentSphere – Academic Dashboard portal\n' +
                '· Developed a responsive web app using HTML, CSS, and vanilla JS showcasing course syllabuses, exams, and class schedules.\n' +
                '· Integrated an interactive CGPA target estimator and structured a common modules layout for seamless authentication routing.\n' +
                '· Programmed mock drag-and-drop assignment upload handlers, managing state in client-side localStorage.';
    }

    if (inputs.skills) inputs.skills.value = skillsText;
    if (inputs.exp) inputs.exp.value = expText;

    updatePreview();
  }

  /* ─────────────────────────────────────────────
     4. DOWNLOAD HANDLER
  ───────────────────────────────────────────── */
  var downloadBtn = document.getElementById('btnDownloadResume');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', function () {
      showToast('Rendering resume layout & compiling PDF download\u2026', 'info', 2500);
      setTimeout(function () {
        showToast('Download complete: ' + (inputs.name.value || 'Resume') + '_CV.pdf', 'success', 3000);
      }, 2500);
    });
  }

  // Pre-fill on initial load
  prefillProfile();

}());
