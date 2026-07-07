/**
 * StudentSphere – Mock User Database
 * In production, replace with real API calls.
 */
export const USERS = [
  {
    email: 'ananya@college.edu.in',
    id: 'CS21B1042',
    password: 'ananya123',
    role: 'student',
    name: 'Ananya',
    initials: 'AS',
    branch: 'Computer science',
    semester: 6,
    roll: 'CS21B1042',
    cgpa: '8.94',
    cgpaDelta: '+0.12 this term',
    cgpaDeltaClass: 'positive',
    attendance: '87%',
    pendingTasks: 3,
    tasksDelta: '2 due this week',
    classRank: '#7',
    totalStudents: 64,
    schedule: [
      { time: '09:00', name: 'Computer networks',    code: 'CS3081', room: 'LH-201', prof: 'Dr. Sneha Patel' },
      { time: '11:00', name: 'Software engineering', code: 'CS3041', room: 'LH-108', prof: 'Dr. Rohan Mehra' }
    ],
    assignments: [
      { name: 'Process scheduling simulation', subject: 'Operating systems',     due: 'Due 11-28' },
      { name: 'TCP congestion control report', subject: 'Computer networks',     due: 'Due 12-02' },
      { name: 'Turing machine construction',   subject: 'Theory of computation', due: 'Due 12-05', download: true }
    ],
    announcements: [
      { title: 'Mid-semester exam schedule released',       source: 'Academic office', time: '2h ago', color: '#3b82f6' },
      { title: 'Google Summer of Code info session',        source: 'Placement cell',  time: '5h ago', color: '#22c55e' },
      { title: 'Hackathon Hyperion 4.0 registrations open', source: 'E-Cell',         time: '1d ago', color: '#f59e0b' }
    ]
  },
  {
    email: 'rahul@college.edu.in',
    id: 'CS21B1087',
    password: 'rahul123',
    role: 'student',
    name: 'Rahul',
    initials: 'RK',
    branch: 'Computer science',
    semester: 6,
    roll: 'CS21B1087',
    cgpa: '7.65',
    cgpaDelta: '-0.08 this term',
    cgpaDeltaClass: 'warning',
    attendance: '72%',
    pendingTasks: 5,
    tasksDelta: '4 due this week',
    classRank: '#24',
    totalStudents: 64,
    schedule: [
      { time: '09:00', name: 'Computer networks', code: 'CS3081', room: 'LH-201', prof: 'Dr. Sneha Patel' },
      { time: '02:00', name: 'Database systems',  code: 'CS3051', room: 'LH-305', prof: 'Dr. Arjun Nair' }
    ],
    assignments: [
      { name: 'ER Diagram for inventory system', subject: 'Database systems',  due: 'Due 11-25' },
      { name: 'TCP congestion control report',   subject: 'Computer networks', due: 'Due 12-02' },
      { name: 'OS scheduler simulation',         subject: 'Operating systems', due: 'Due 12-10', download: true }
    ],
    announcements: [
      { title: 'Attendance warning: below 75%',           source: 'Academic office', time: '1h ago', color: '#ef4444' },
      { title: 'Placement drive: TCS on-campus Dec 10',   source: 'Placement cell',  time: '3h ago', color: '#3b82f6' },
      { title: 'Library fine clearance last date Nov 30', source: 'Library',         time: '1d ago', color: '#f59e0b' }
    ]
  },
  {
    email: 'priya@college.edu.in',
    id: 'EC21B1015',
    password: 'priya123',
    role: 'student',
    name: 'Priya',
    initials: 'PS',
    branch: 'Electronics & Communication',
    semester: 5,
    roll: 'EC21B1015',
    cgpa: '9.21',
    cgpaDelta: '+0.34 this term',
    cgpaDeltaClass: 'positive',
    attendance: '94%',
    pendingTasks: 1,
    tasksDelta: '1 due this week',
    classRank: '#2',
    totalStudents: 58,
    schedule: [
      { time: '10:00', name: 'Signals & Systems', code: 'EC3021', room: 'LH-102', prof: 'Dr. Kavitha Menon' },
      { time: '01:00', name: 'VLSI Design',       code: 'EC3031', room: 'LH-210', prof: 'Dr. Suresh Babu' }
    ],
    assignments: [
      { name: 'VLSI Full Adder Layout', subject: 'VLSI Design', due: 'Due 12-01' }
    ],
    announcements: [
      { title: 'IEEE Student Branch seminar',             source: 'IEEE Branch', time: '3h ago', color: '#3b82f6' },
      { title: 'GATE 2024 preparation workshop',          source: 'EC Dept',     time: '1d ago', color: '#22c55e' },
      { title: 'Scholarship application: AICTE deadline', source: 'Admin',       time: '2d ago', color: '#f59e0b' }
    ]
  },
  {
    email: 'arjun@college.edu.in',
    id: 'ME21B1033',
    password: 'arjun123',
    role: 'student',
    name: 'Arjun',
    initials: 'AV',
    branch: 'Mechanical Engineering',
    semester: 4,
    roll: 'ME21B1033',
    cgpa: '8.10',
    cgpaDelta: '+0.05 this term',
    cgpaDeltaClass: 'positive',
    attendance: '80%',
    pendingTasks: 4,
    tasksDelta: '2 due this week',
    classRank: '#11',
    totalStudents: 72,
    schedule: [
      { time: '08:00', name: 'Thermodynamics',  code: 'ME3011', room: 'LH-401', prof: 'Dr. Ramesh Kumar' },
      { time: '12:00', name: 'Fluid Mechanics', code: 'ME3021', room: 'Lab-3',  prof: 'Dr. Anil Sharma' }
    ],
    assignments: [
      { name: 'Carnot cycle analysis report', subject: 'Thermodynamics',    due: 'Due 11-28' },
      { name: 'Pipe flow simulation',         subject: 'Fluid Mechanics',    due: 'Due 12-05' },
      { name: 'CAD model of gear assembly',   subject: 'Engineering Design', due: 'Due 12-08', download: true },
      { name: 'Stress analysis using FEM',    subject: 'Solid Mechanics',    due: 'Due 12-12' }
    ],
    announcements: [
      { title: 'SAE Collegiate competition registrations', source: 'Sports cell',    time: '1h ago', color: '#f59e0b' },
      { title: 'Workshop: CNC machining basics Dec 3',     source: 'ME Department',  time: '4h ago', color: '#3b82f6' },
      { title: 'Mid-semester exam schedule released',      source: 'Academic office', time: '1d ago', color: '#6b7280' }
    ]
  },
  {
    email: 'sneha@college.edu.in',
    id: 'CS21B1055',
    password: 'sneha123',
    role: 'student',
    name: 'Sneha',
    initials: 'SR',
    branch: 'Computer science',
    semester: 6,
    roll: 'CS21B1055',
    cgpa: '9.05',
    cgpaDelta: '+0.20 this term',
    cgpaDeltaClass: 'positive',
    attendance: '91%',
    pendingTasks: 2,
    tasksDelta: '1 due this week',
    classRank: '#4',
    totalStudents: 64,
    schedule: [
      { time: '09:00', name: 'Machine Learning', code: 'CS4011', room: 'LH-201', prof: 'Dr. Priya Das' },
      { time: '11:00', name: 'Cloud Computing',  code: 'CS4021', room: 'LH-108', prof: 'Dr. Vikram Singh' }
    ],
    assignments: [
      { name: 'SVM classification project', subject: 'Machine Learning', due: 'Due 12-01' },
      { name: 'AWS deployment report',       subject: 'Cloud Computing',  due: 'Due 12-07', download: true }
    ],
    announcements: [
      { title: 'Google tech talk — registrations open',  source: 'Placement cell',  time: '5h ago', color: '#22c55e' },
      { title: 'Hackathon Hyperion 4.0 registrations',   source: 'E-Cell',          time: '1d ago', color: '#7e22ce' },
      { title: 'Research internship: IIT Madras summer', source: 'Academic office', time: '2d ago', color: '#3b82f6' }
    ]
  },
  {
    email: 'sneha.patel@college.edu.in',
    id: 'PROF001',
    password: 'sneha123',
    role: 'professor',
    name: 'Dr. Sneha Patel',
    initials: 'SP',
    branch: 'Computer Science',
    department: 'Computer Science & Engineering',
    designation: 'Professor',
    schedule: [
      { id: 'meet-1', time: '09:00 - 10:30', name: 'Computer networks', code: 'CS3081', room: 'LH-201', type: 'lecture', day: 'Mon' },
      { id: 'meet-2', time: '13:30 - 15:00', name: 'Theory of computation', code: 'CS3061', room: 'LH-201', type: 'lecture', day: 'Tue' },
      { id: 'meet-3', time: '09:00 - 10:30', name: 'Computer networks', code: 'CS3081', room: 'LH-201', type: 'lecture', day: 'Wed' },
      { id: 'meet-4', time: '09:00 - 10:30', name: 'Theory of computation', code: 'CS3061', room: 'LH-201', type: 'lecture', day: 'Fri' }
    ],
    classes: [
      { code: 'CS3081', name: 'Computer networks', students: 64 },
      { code: 'CS3061', name: 'Theory of computation', students: 48 }
    ],
    mentorshipRequests: [
      { id: 1, studentName: 'Ananya Sharma', roll: 'CS21B1042', topic: 'Research on Distributed Systems', status: 'pending' },
      { id: 2, studentName: 'Rahul Mehta', roll: 'CS21B1087', topic: 'Career Guidance in Networking', status: 'pending' }
    ]
  },
  {
    email: 'tpo@college.edu.in',
    id: 'TPO001',
    password: 'tpo123',
    role: 'tpo',
    name: 'Dr. Ramesh Nair',
    initials: 'RN',
    department: 'Training & Placement Cell',
    designation: 'Training & Placement Officer',
    branch: 'Administration',
    college: 'NIT Trichy',
    batch: '2021',
    stats: {
      totalStudents: 320,
      placed: 187,
      avgPackage: '12.4 LPA',
      highestPackage: '42 LPA',
      drivesThisYear: 34,
      offersThisYear: 210,
    }
  },
  // ── Admin / Principal ──────────────────────────────────────────────
  {
    email:    'admin@college.edu.in',
    id:       'ADMIN001',
    password: 'admin123',
    role:     'admin',
    name:     'Dr. Principal',
    initials: 'DP',
    title:    'Principal',
    institution: 'National Institute of Technology',
  }
];

