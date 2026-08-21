/**
 * Student Record Field Schema Registry
 * ====================================
 * Central configuration defining data types, validation rules, sanitizers,
 * options sets, and display formats for every student record field.
 */

export const BRANCH_OPTIONS = [
  'Computer Science & Engineering',
  'Information Technology',
  'Electronics & Communication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'AI & Data Science',
  'AI & Machine Learning',
  'Computer Science & Business Systems',
  'Chemical Engineering',
  'Biotechnology',
  'Other'
];

export const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export const BATCH_YEAR_OPTIONS = [
  2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030
];

export const QUOTA_OPTIONS = [
  'General',
  'OBC',
  'SC',
  'ST',
  'EWS',
  'Management',
  'NRI',
  'Sports',
  'Defense',
  'Other'
];

export const ENTRANCE_EXAM_OPTIONS = [
  'JEE Main',
  'JEE Advanced',
  'State CET / WBJEE / MHT-CET',
  'KCET / COMEDK',
  'BITSAT',
  'Management / Direct Merit',
  'CUET',
  'Other'
];

export const FIELD_SCHEMAS = {
  // ── Identity & Basic Info ──────────────────────────────────────────────────
  full_name: {
    label: 'Full Name',
    type: 'text',
    required: true,
    placeholder: 'Enter student full name',
    validate: (val) => {
      if (!val || !val.trim()) return 'Full name is required';
      if (val.trim().length < 2) return 'Full name must be at least 2 characters';
      if (val.trim().length > 100) return 'Full name cannot exceed 100 characters';
      return null;
    },
    sanitize: (val) => val,
  },
  roll_no: {
    label: 'Roll Number',
    type: 'text',
    required: true,
    placeholder: 'e.g. 2024CS001',
    validate: (val) => {
      if (!val || !val.trim()) return 'Roll number is required';
      if (val.trim().length < 3) return 'Roll number is too short';
      return null;
    },
    sanitize: (val) => val.trim().toUpperCase(),
  },
  email: {
    label: 'Email',
    type: 'email',
    required: true,
    placeholder: 'student@example.com',
    validate: (val) => {
      if (!val || !val.trim()) return 'Email is required';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val.trim())) return 'Invalid email address format';
      return null;
    },
    sanitize: (val) => val.trim().toLowerCase(),
  },
  phone: {
    label: 'Phone Number',
    type: 'phone',
    required: false,
    placeholder: '10-digit mobile number',
    validate: (val) => {
      if (!val) return null; // Optional
      const clean = String(val).replace(/\D/g, '');
      if (clean.length > 0 && !/^[6-9]\d{9}$/.test(clean)) {
        return 'Must be a valid 10-digit Indian phone number starting with 6-9';
      }
      return null;
    },
    sanitize: (val) => String(val || '').replace(/\D/g, '').slice(0, 10),
  },
  branch: {
    label: 'Branch',
    type: 'select',
    options: BRANCH_OPTIONS,
    required: true,
    validate: (val) => (!val ? 'Branch is required' : null),
  },
  semester: {
    label: 'Semester',
    type: 'select',
    options: SEMESTER_OPTIONS,
    required: true,
    validate: (val) => {
      const num = Number(val);
      if (!num || num < 1 || num > 8) return 'Semester must be between 1 and 8';
      return null;
    },
  },
  batch_year: {
    label: 'Batch Year',
    type: 'select',
    options: BATCH_YEAR_OPTIONS,
    required: true,
    validate: (val) => {
      const yr = Number(val);
      if (!yr || yr < 2000 || yr > 2050) return 'Invalid batch year';
      return null;
    },
  },
  profile_photo_url: {
    label: 'Profile Photo',
    type: 'photo',
    required: false,
    placeholder: 'Drop image or enter photo URL',
    validate: (val) => {
      if (!val) return null;
      if (typeof val === 'string' && !val.startsWith('http://') && !val.startsWith('https://') && !val.startsWith('data:image')) {
        return 'Must be a valid HTTPS URL or data URL';
      }
      return null;
    },
  },

  // ── Academic Snapshot ──────────────────────────────────────────────────────
  cgpa: {
    label: 'CGPA',
    type: 'number',
    step: '0.01',
    min: 0,
    max: 10,
    sensitive: true,
    placeholder: '0.00 - 10.00',
    validate: (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const num = parseFloat(val);
      if (isNaN(num)) return 'CGPA must be a number';
      if (num < 0 || num > 10) return 'CGPA must be between 0.00 and 10.00';
      return null;
    },
    renderValue: (val) => (val !== null && val !== undefined && val !== '' ? parseFloat(val).toFixed(2) : '—'),
  },
  attendance_pct: {
    label: 'Attendance %',
    type: 'number',
    step: '0.1',
    min: 0,
    max: 100,
    placeholder: '0 - 100',
    validate: (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const num = parseFloat(val);
      if (isNaN(num)) return 'Attendance must be a number';
      if (num < 0 || num > 100) return 'Attendance must be between 0% and 100%';
      return null;
    },
    renderValue: (val) => (val !== null && val !== undefined && val !== '' ? `${parseFloat(val).toFixed(1)}%` : '—'),
  },
  active_backlogs: {
    label: 'Active Backlogs',
    type: 'number',
    step: '1',
    min: 0,
    sensitive: true,
    placeholder: '0 or more',
    validate: (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 0) return 'Backlogs must be a positive whole number';
      return null;
    },
    renderValue: (val) => (val !== null && val !== undefined && val !== '' ? `${parseInt(val, 10)}` : '0'),
  },
  profile_complete: {
    label: 'Profile Complete',
    type: 'boolean',
    readOnly: false,
    renderValue: (val) => (val ? 'Completed ✓' : 'Incomplete ✕'),
  },
  dpdp_consent_given: {
    label: 'DPDP Consent',
    type: 'boolean',
    readOnly: false,
    renderValue: (val) => (val ? 'Given ✓' : 'Not Given ✕'),
  },
  is_active: {
    label: 'Account Active',
    type: 'boolean',
    sensitive: true,
    renderValue: (val) => (val !== false ? 'Active' : 'Inactive'),
  },

  // ── Admission Details ──────────────────────────────────────────────────────
  entrance_exam_type: {
    label: 'Entrance Exam',
    type: 'select',
    options: ENTRANCE_EXAM_OPTIONS,
    placeholder: 'Select entrance exam',
  },
  entrance_rank: {
    label: 'Entrance Rank/Score',
    type: 'text',
    placeholder: 'e.g. AIR 12450 / 98.5 %ile',
    validate: (val) => {
      if (val && val.length > 50) return 'Rank string too long (max 50 chars)';
      return null;
    },
  },
  quota_category: {
    label: 'Category / Quota',
    type: 'select',
    options: QUOTA_OPTIONS,
    sensitive: true,
    placeholder: 'Select quota/category',
  },
  college_name: {
    label: 'College Name',
    type: 'text',
    readOnly: false,
    placeholder: 'e.g. Institute of Engineering & Technology',
  },

  // ── Administrative Details ─────────────────────────────────────────────────
  fees_submitted: {
    label: 'Fees Submitted (₹)',
    type: 'number',
    min: 0,
    step: '100',
    sensitive: true,
    placeholder: 'Amount in INR',
    validate: (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const num = parseFloat(val);
      if (isNaN(num) || num < 0) return 'Fees must be a positive amount';
      return null;
    },
    renderValue: (val) => (val !== null && val !== undefined && val !== '' ? `₹${Number(val).toLocaleString('en-IN')}` : '—'),
  },
  scholarship_details: {
    label: 'Scholarship Details',
    type: 'textarea',
    sensitive: true,
    placeholder: 'Details about awarded scholarship / concessions',
    validate: (val) => {
      if (val && val.length > 500) return 'Cannot exceed 500 characters';
      return null;
    },
  },
  hostel_address: {
    label: 'Hostel Address / Room',
    type: 'textarea',
    placeholder: 'Block / Hostel name, Room number',
    validate: (val) => {
      if (val && val.length > 250) return 'Cannot exceed 250 characters';
      return null;
    },
  },
  home_address: {
    label: 'Permanent Home Address',
    type: 'textarea',
    placeholder: 'Street, City, State, Pincode',
    validate: (val) => {
      if (val && val.length > 300) return 'Cannot exceed 300 characters';
      return null;
    },
  },
  parent_contact: {
    label: 'Parent / Guardian Contact',
    type: 'phone',
    placeholder: '10-digit mobile number',
    validate: (val) => {
      if (!val) return null;
      const clean = String(val).replace(/\D/g, '');
      if (clean.length > 0 && !/^[6-9]\d{9}$/.test(clean)) {
        return 'Must be a valid 10-digit Indian phone number starting with 6-9';
      }
      return null;
    },
    sanitize: (val) => String(val || '').replace(/\D/g, '').slice(0, 10),
  },

  // ── Career / Links ─────────────────────────────────────────────────────────
  linkedin_url: {
    label: 'LinkedIn URL',
    type: 'url',
    placeholder: 'https://linkedin.com/in/username',
    validate: (val) => {
      if (!val || !val.trim()) return null;
      if (!/^https?:\/\/(www\.)?linkedin\.com\/.+/i.test(val.trim())) {
        return 'Must be a valid LinkedIn profile URL';
      }
      return null;
    },
    sanitize: (val) => val.trim(),
  },
  github_url: {
    label: 'GitHub URL',
    type: 'url',
    placeholder: 'https://github.com/username',
    validate: (val) => {
      if (!val || !val.trim()) return null;
      if (!/^https?:\/\/(www\.)?github\.com\/.+/i.test(val.trim())) {
        return 'Must be a valid GitHub profile URL';
      }
      return null;
    },
    sanitize: (val) => val.trim(),
  },
  resume_url: {
    label: 'Resume URL',
    type: 'url',
    placeholder: 'https://example.com/resume.pdf',
    validate: (val) => {
      if (!val || !val.trim()) return null;
      if (!/^https?:\/\/.+/i.test(val.trim())) {
        return 'Must be a valid HTTPS URL';
      }
      return null;
    },
    sanitize: (val) => val.trim(),
  },
};

/**
 * Get schema for a field or fallback default
 */
export function getFieldSchema(fieldKey) {
  return FIELD_SCHEMAS[fieldKey] || {
    label: fieldKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    type: 'text',
    validate: () => null,
    sanitize: (v) => v,
  };
}

/**
 * Safe formatter for rendering read values
 */
export function formatFieldValue(fieldKey, value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const schema = getFieldSchema(fieldKey);
  if (schema.renderValue) {
    return schema.renderValue(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
}
