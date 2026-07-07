/**
 * StudentSphere – Login Page Logic
 * File: login.js
 *
 * Responsibilities:
 *  1. Password show/hide toggle
 *  2. Role-selector (single-active)
 *  3. Real-time + on-submit form validation
 *  4. Mock user authentication → save to localStorage → redirect to dashboard
 *  5. Forgot-password modal (open / close / send reset)
 *  6. Toast notification helper
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     MOCK USER DATABASE
     (Replace with a real API call in production)

     Each user object contains all fields that the
     student dashboard will personalise.
  ───────────────────────────────────────────── */
  var USERS = [
    {
      // Credentials
      email:    'ananya@college.edu.in',
      id:       'CS21B1042',
      password: 'ananya123',
      role:     'student',
      // Profile
      name:       'Ananya',
      initials:   'AS',
      branch:     'Computer science',
      semester:   6,
      roll:       'CS21B1042',
      // Stats
      cgpa:           '8.94',
      cgpaDelta:      '+0.12 this term',
      cgpaDeltaClass: 'positive',
      attendance:     '87%',
      pendingTasks:   3,
      tasksDelta:     '2 due this week',
      classRank:      '#7',
      totalStudents:  64,
      // Schedule
      schedule: [
        { time: '09:00', name: 'Computer networks',   code: 'CS3081', room: 'LH-201', prof: 'Dr. Sneha Patel' },
        { time: '11:00', name: 'Software engineering', code: 'CS3041', room: 'LH-108', prof: 'Dr. Rohan Mehra' }
      ],
      // Assignments
      assignments: [
        { name: 'Process scheduling simulation', subject: 'Operating systems',     due: 'Due 11-28' },
        { name: 'TCP congestion control report', subject: 'Computer networks',     due: 'Due 12-02' },
        { name: 'Turing machine construction',   subject: 'Theory of computation', due: 'Due 12-05', download: true }
      ],
      // Announcements
      announcements: [
        { title: 'Mid-semester exam schedule released', source: 'Academic office', time: '2h ago',  color: '#3b82f6' },
        { title: 'Google Summer of Code info session',  source: 'Placement cell',  time: '5h ago',  color: '#22c55e' },
        { title: 'Hackathon Hyperion 4.0 registrations open', source: 'E-Cell',   time: '1d ago',  color: '#f59e0b' }
      ]
    },
    {
      email:    'rahul@college.edu.in',
      id:       'CS21B1087',
      password: 'rahul123',
      role:     'student',
      name:       'Rahul',
      initials:   'RK',
      branch:     'Computer science',
      semester:   6,
      roll:       'CS21B1087',
      cgpa:           '7.65',
      cgpaDelta:      '-0.08 this term',
      cgpaDeltaClass: 'warning',
      attendance:     '72%',
      pendingTasks:   5,
      tasksDelta:     '4 due this week',
      classRank:      '#24',
      totalStudents:  64,
      schedule: [
        { time: '09:00', name: 'Computer networks',   code: 'CS3081', room: 'LH-201', prof: 'Dr. Sneha Patel' },
        { time: '02:00', name: 'Database systems',    code: 'CS3051', room: 'LH-305', prof: 'Dr. Arjun Nair' }
      ],
      assignments: [
        { name: 'ER Diagram for inventory system', subject: 'Database systems',  due: 'Due 11-25' },
        { name: 'TCP congestion control report',   subject: 'Computer networks', due: 'Due 12-02' },
        { name: 'OS scheduler simulation',         subject: 'Operating systems', due: 'Due 12-10', download: true }
      ],
      announcements: [
        { title: 'Attendance warning: below 75%',          source: 'Academic office', time: '1h ago',  color: '#ef4444' },
        { title: 'Placement drive: TCS on-campus Dec 10',  source: 'Placement cell',  time: '3h ago',  color: '#3b82f6' },
        { title: 'Library fine clearance last date Nov 30',source: 'Library',         time: '1d ago',  color: '#f59e0b' }
      ]
    },
    {
      email:    'priya@college.edu.in',
      id:       'EC21B1015',
      password: 'priya123',
      role:     'student',
      name:       'Priya',
      initials:   'PS',
      branch:     'Electronics & Communication',
      semester:   5,
      roll:       'EC21B1015',
      cgpa:           '9.21',
      cgpaDelta:      '+0.34 this term',
      cgpaDeltaClass: 'positive',
      attendance:     '94%',
      pendingTasks:   1,
      tasksDelta:     '1 due this week',
      classRank:      '#2',
      totalStudents:  58,
      schedule: [
        { time: '10:00', name: 'Signals & Systems',   code: 'EC3021', room: 'LH-102', prof: 'Dr. Kavitha Menon' },
        { time: '01:00', name: 'VLSI Design',         code: 'EC3031', room: 'LH-210', prof: 'Dr. Suresh Babu' }
      ],
      assignments: [
        { name: 'VLSI Full Adder Layout', subject: 'VLSI Design', due: 'Due 12-01' }
      ],
      announcements: [
        { title: 'ECE symposium registrations open',          source: 'E-Cell',         time: '30m ago', color: '#7e22ce' },
        { title: 'Mid-semester exam schedule released',       source: 'Academic office', time: '2h ago',  color: '#3b82f6' },
        { title: 'ISRO internship opportunity — apply now!',  source: 'Placement cell',  time: '12h ago', color: '#22c55e' }
      ]
    },
    {
      email:    'arjun@college.edu.in',
      id:       'ME21B1033',
      password: 'arjun123',
      role:     'student',
      name:       'Arjun',
      initials:   'AV',
      branch:     'Mechanical Engineering',
      semester:   4,
      roll:       'ME21B1033',
      cgpa:           '8.10',
      cgpaDelta:      '+0.05 this term',
      cgpaDeltaClass: 'positive',
      attendance:     '80%',
      pendingTasks:   4,
      tasksDelta:     '2 due this week',
      classRank:      '#11',
      totalStudents:  72,
      schedule: [
        { time: '08:00', name: 'Thermodynamics',    code: 'ME3011', room: 'LH-401', prof: 'Dr. Ramesh Kumar' },
        { time: '12:00', name: 'Fluid Mechanics',   code: 'ME3021', room: 'Lab-3',  prof: 'Dr. Anil Sharma' }
      ],
      assignments: [
        { name: 'Carnot cycle analysis report',      subject: 'Thermodynamics',    due: 'Due 11-28' },
        { name: 'Pipe flow simulation',              subject: 'Fluid Mechanics',    due: 'Due 12-05' },
        { name: 'CAD model of gear assembly',        subject: 'Engineering Design', due: 'Due 12-08', download: true },
        { name: 'Stress analysis using FEM',         subject: 'Solid Mechanics',    due: 'Due 12-12' }
      ],
      announcements: [
        { title: 'SAE Collegiate competition registrations', source: 'Sports cell',    time: '1h ago',  color: '#f59e0b' },
        { title: 'Workshop: CNC machining basics Dec 3',     source: 'ME Department',  time: '4h ago',  color: '#3b82f6' },
        { title: 'Mid-semester exam schedule released',      source: 'Academic office', time: '1d ago',  color: '#6b7280' }
      ]
    },
    {
      email:    'sneha@college.edu.in',
      id:       'CS21B1055',
      password: 'sneha123',
      role:     'student',
      name:       'Sneha',
      initials:   'SR',
      branch:     'Computer science',
      semester:   6,
      roll:       'CS21B1055',
      cgpa:           '9.05',
      cgpaDelta:      '+0.20 this term',
      cgpaDeltaClass: 'positive',
      attendance:     '91%',
      pendingTasks:   2,
      tasksDelta:     '1 due this week',
      classRank:      '#4',
      totalStudents:  64,
      schedule: [
        { time: '09:00', name: 'Machine Learning',   code: 'CS4011', room: 'LH-201', prof: 'Dr. Priya Das' },
        { time: '11:00', name: 'Cloud Computing',    code: 'CS4021', room: 'LH-108', prof: 'Dr. Vikram Singh' }
      ],
      assignments: [
        { name: 'SVM classification project',  subject: 'Machine Learning', due: 'Due 12-01' },
        { name: 'AWS deployment report',        subject: 'Cloud Computing',  due: 'Due 12-07', download: true }
      ],
      announcements: [
        { title: 'Google tech talk — registrations open',    source: 'Placement cell',  time: '5h ago',  color: '#22c55e' },
        { title: 'Hackathon Hyperion 4.0 registrations',     source: 'E-Cell',          time: '1d ago',  color: '#7e22ce' },
        { title: 'Research internship: IIT Madras summer',   source: 'Academic office', time: '2d ago',  color: '#3b82f6' }
      ]
    }
  ];

  /* ─────────────────────────────────────────────
     DOM References
  ───────────────────────────────────────────── */
  var form        = document.getElementById('loginForm');
  var emailInput  = document.getElementById('emailId');
  var emailError  = document.getElementById('emailId-error');
  var pwInput     = document.getElementById('password');
  var pwError     = document.getElementById('password-error');
  var togglePwBtn = document.getElementById('togglePw');
  var eyeIcon     = document.getElementById('eyeIcon');
  var eyeOffIcon  = document.getElementById('eyeOffIcon');
  var submitBtn   = document.getElementById('submitBtn');
  var roleBtns    = document.querySelectorAll('.role-btn');

  var forgotLink    = document.getElementById('forgotLink');
  var modalOverlay  = document.getElementById('modalOverlay');
  var modalCloseBtn = document.getElementById('modalClose');
  var modalCancelBtn= document.getElementById('modalCancel');
  var modalSendBtn  = document.getElementById('modalSend');
  var resetEmailInput = document.getElementById('resetEmail');
  var resetEmailError = document.getElementById('resetEmail-error');

  var toast = document.getElementById('toast');

  /* ─────────────────────────────────────────────
     State
  ───────────────────────────────────────────── */
  var selectedRole = 'student';
  var toastTimer   = null;

  /* ─────────────────────────────────────────────
     Utility: Validators
  ───────────────────────────────────────────── */
  function isValidIdentifier(value) {
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var idRegex    = /^[A-Za-z0-9]{4,20}$/;
    return emailRegex.test(value) || idRegex.test(value);
  }

  function isValidPassword(value) {
    return value.trim().length >= 6;
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function showError(input, errorEl, message) {
    input.classList.add('has-error');
    input.setAttribute('aria-invalid', 'true');
    errorEl.textContent = message;
    errorEl.classList.add('visible');
  }

  function clearError(input, errorEl) {
    input.classList.remove('has-error');
    input.setAttribute('aria-invalid', 'false');
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }

  function showToast(message, type, duration) {
    type     = type     || 'default';
    duration = duration || 3000;

    toast.className = 'toast';
    if (type !== 'default') toast.classList.add(type);

    toast.textContent = message;
    toast.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, duration);
  }

  /* ─────────────────────────────────────────────
     Lookup user by identifier + password + role
  ───────────────────────────────────────────── */
  function findUser(identifier, password, role) {
    var id = identifier.toLowerCase().trim();
    var pw = password.trim();

    for (var i = 0; i < USERS.length; i++) {
      var u = USERS[i];
      var emailMatch = u.email.toLowerCase() === id;
      var idMatch    = u.id.toLowerCase()    === id;
      var pwMatch    = u.password === pw;
      var roleMatch  = u.role === role;

      if ((emailMatch || idMatch) && pwMatch && roleMatch) {
        return u;
      }
    }
    return null;
  }

  /* ─────────────────────────────────────────────
     1. Password Show / Hide Toggle
  ───────────────────────────────────────────── */
  togglePwBtn.addEventListener('click', function () {
    var isHidden = pwInput.type === 'password';
    pwInput.type = isHidden ? 'text' : 'password';
    togglePwBtn.setAttribute('aria-label',  isHidden ? 'Hide password' : 'Show password');
    togglePwBtn.setAttribute('aria-pressed', String(isHidden));
    eyeIcon.style.display    = isHidden ? 'none' : '';
    eyeOffIcon.style.display = isHidden ? ''     : 'none';
  });

  /* ─────────────────────────────────────────────
     2. Role Selector
  ───────────────────────────────────────────── */
  roleBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      roleBtns.forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      selectedRole = btn.getAttribute('data-role');
    });
  });

  /* ─────────────────────────────────────────────
     3. Real-time Validation
  ───────────────────────────────────────────── */
  emailInput.addEventListener('blur', function () {
    var val = emailInput.value.trim();
    if (!val) {
      showError(emailInput, emailError, 'Email or student ID is required.');
    } else if (!isValidIdentifier(val)) {
      showError(emailInput, emailError, 'Enter a valid email or student ID.');
    } else {
      clearError(emailInput, emailError);
    }
  });

  emailInput.addEventListener('input', function () {
    if (emailInput.classList.contains('has-error') && emailInput.value.trim()) {
      clearError(emailInput, emailError);
    }
  });

  pwInput.addEventListener('blur', function () {
    var val = pwInput.value;
    if (!val) {
      showError(pwInput, pwError, 'Password is required.');
    } else if (!isValidPassword(val)) {
      showError(pwInput, pwError, 'Password must be at least 6 characters.');
    } else {
      clearError(pwInput, pwError);
    }
  });

  pwInput.addEventListener('input', function () {
    if (pwInput.classList.contains('has-error') && pwInput.value) {
      clearError(pwInput, pwError);
    }
  });

  /* ─────────────────────────────────────────────
     4. Form Submit + Authentication + Redirect
  ───────────────────────────────────────────── */
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var valid = true;

    var emailVal = emailInput.value.trim();
    if (!emailVal) {
      showError(emailInput, emailError, 'Email or student ID is required.');
      valid = false;
    } else if (!isValidIdentifier(emailVal)) {
      showError(emailInput, emailError, 'Enter a valid email or student ID.');
      valid = false;
    } else {
      clearError(emailInput, emailError);
    }

    var pwVal = pwInput.value;
    if (!pwVal) {
      showError(pwInput, pwError, 'Password is required.');
      valid = false;
    } else if (!isValidPassword(pwVal)) {
      showError(pwInput, pwError, 'Password must be at least 6 characters.');
      valid = false;
    } else {
      clearError(pwInput, pwError);
    }

    if (!valid) {
      if (emailInput.classList.contains('has-error')) {
        emailInput.focus();
      } else {
        pwInput.focus();
      }
      return;
    }

    submitBtn.classList.add('loading');
    submitBtn.setAttribute('disabled', 'true');
    submitBtn.querySelector('.btn-text').textContent = 'Signing in\u2026';

    setTimeout(function () {
      var user = findUser(emailVal, pwVal, selectedRole);

      if (user) {
        localStorage.setItem('ss_user', JSON.stringify(user));
        showToast('Welcome back, ' + user.name + '! Redirecting\u2026', 'success', 2000);
        setTimeout(function () {
          window.location.href = '../studentDashboard/dashboard/student.html';
        }, 1200);
      } else {
        resetSubmitBtn();
        showToast('Incorrect credentials. Please try again.', 'error', 3500);
        showError(pwInput, pwError, 'Invalid login details.');
        pwInput.focus();
      }
    }, 1000);
  });

  function resetSubmitBtn() {
    submitBtn.classList.remove('loading');
    submitBtn.removeAttribute('disabled');
    submitBtn.querySelector('.btn-text').textContent = 'Sign in';
  }

  /* ─────────────────────────────────────────────
     5. Forgot Password Modal
  ───────────────────────────────────────────── */
  function openModal() {
    modalOverlay.classList.add('open');
    setTimeout(function () { resetEmailInput.focus(); }, 100);
    document.addEventListener('keydown', handleModalKeydown);
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
    clearError(resetEmailInput, resetEmailError);
    resetEmailInput.value = '';
    document.removeEventListener('keydown', handleModalKeydown);
    forgotLink.focus();
  }

  function handleModalKeydown(e) {
    if (e.key === 'Escape') { closeModal(); }
  }

  forgotLink.addEventListener('click', function (e) {
    e.preventDefault();
    openModal();
  });

  modalCloseBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) { closeModal(); }
  });

  modalSendBtn.addEventListener('click', function () {
    var val = resetEmailInput.value.trim();

    if (!val) {
      showError(resetEmailInput, resetEmailError, 'Please enter your registered email.');
      resetEmailInput.focus();
      return;
    }

    if (!isValidEmail(val)) {
      showError(resetEmailInput, resetEmailError, 'Enter a valid email address.');
      resetEmailInput.focus();
      return;
    }

    clearError(resetEmailInput, resetEmailError);

    // Loading state on send button
    modalSendBtn.textContent    = 'Sending\u2026';
    modalSendBtn.disabled       = true;

    /**
     * TODO: Replace with real password-reset API call.
     * fetch('/api/forgot-password', { method:'POST', body: JSON.stringify({ email: val }) })
     */
    setTimeout(function () {
      modalSendBtn.textContent = 'Send Reset Link';
      modalSendBtn.disabled    = false;
      closeModal();
      showToast('Reset link sent to ' + val, 'success', 3500);
    }, 1500);
  });

  // Live validation in reset email field
  resetEmailInput.addEventListener('input', function () {
    if (resetEmailInput.classList.contains('has-error') && resetEmailInput.value.trim()) {
      clearError(resetEmailInput, resetEmailError);
    }
  });

  /* ─────────────────────────────────────────────
     6. Policy Link (placeholder)
  ───────────────────────────────────────────── */
  document.getElementById('policyLink').addEventListener('click', function (e) {
    e.preventDefault();
    showToast('Data usage policy will open here.', 'default', 2500);
  });

}());
