// METU Ankara Mechanical Engineering and Mechatronics minor planning template.
// Checked against primary university sources on 2026-09-24. See SOURCES.md.
// These are requirements, not a student's transcript or approved course counting.
// All credits below are METU local credits, never ECTS.

export const verifiedOn = "2026-09-24";

export const sources = [
  {
    title: "Mechanical Engineering curriculum",
    url: "https://me.metu.edu.tr/major",
    note: "Major course sequence and local credits; five technical electives plus one restricted elective.",
  },
  {
    title: "Current METU academic catalog",
    url: "https://catalog.metu.edu.tr/program.php?fac_prog=569",
    note: "Includes BA 100 and OHS 301, both noncredit. Groups the restricted slot within six technical electives.",
  },
  {
    title: "Mechanical Engineering elective rules",
    url: "https://me.metu.edu.tr/elective-courses",
    note: "Restricted design-course pool, five technical electives, one free elective and two nontechnical electives.",
  },
  {
    title: "Mechatronics minor course list",
    url: "https://me.metu.edu.tr/system/files/mechaminor_2_0.pdf",
    note: "For minor registrations in or after Fall 2019: five compulsory groups plus four electives outside the major; at least two electives at 400 level.",
  },
  {
    title: "Minor program directive",
    url: "https://oidb.metu.edu.tr/en/node/62",
    note: "Separate program GPA; shared courses require formal counting; at least four courses and 12 credits distinct from the major.",
  },
  {
    title: "Undergraduate academic regulations",
    url: "https://oidb.metu.edu.tr/en/node/24",
    note: "Local-credit GPA, latest repeat grade, grade exclusions, prerequisite rules and graduation requirements.",
  },
  {
    title: "Course credits and grade scale",
    url: "https://oidb.metu.edu.tr/en/course-credit-system",
    note: "AA–FF coefficients; NA equals zero; S, U, EX, I and W do not enter GPA.",
  },
  {
    title: "Mechanical Engineering registration guide",
    url: "https://me.metu.edu.tr/registration-guide",
    note: "Consult the live registration system for prerequisites, term availability, quotas, surname sections and approvals.",
  },
];

export const gradePoints = Object.freeze({
  AA: 4,
  BA: 3.5,
  BB: 3,
  CB: 2.5,
  CC: 2,
  DC: 1.5,
  DD: 1,
  FD: 0.5,
  FF: 0,
  NA: 0,
});

const sharedNote =
  "Can count toward both GPAs only after formal approval. The template assumes this shared requirement; verify it against the minor transcript.";
const course = (code, name, credits, semester, extra = {}) => ({
  id: code.replace(/\s/g, ""),
  code,
  name,
  credits,
  semester,
  major: true,
  minor: false,
  kind: credits === 0 ? "noncredit" : "required",
  ...extra,
});
const majorSlot = (id, name, semester, kind, extra = {}) =>
  course(id, name, 3, semester, {
    kind,
    placeholder: true,
    notes:
      "Choose the actual approved course and its local credits before treating this requirement as complete.",
    ...extra,
  });

export const courses = [
  course("ME 117", "Computer Aided Engineering Drawing", 3, 1),
  course("MATH 119", "Calculus with Analytic Geometry", 5, 1),
  course("PHYS 105", "General Physics I", 4, 1),
  course("CENG 240", "Programming with Python for Engineers", 3, 1, {
    minor: true,
    minorGroup: "programming",
    minorApprovalRequired: true,
    notes: sharedNote,
  }),
  course("ENG 101", "English for Academic Purposes I", 4, 1),
  course("OHS 101", "Occupational Health and Safety I", 0, 1),
  course(
    "IS 100",
    "Introduction to Information Technologies and Applications",
    0,
    1,
  ),
  course("ME 110", "Introduction to Mechanical Engineering", 2, 2),
  course("MATH 120", "Calculus of Functions of Several Variables", 5, 2),
  course("PHYS 106", "General Physics II", 4, 2),
  course("CHEM 107", "General Chemistry", 4, 2),
  course("ENG 102", "English for Academic Purposes II", 4, 2),
  course("BA 100", "Career Planning", 0, 2, {
    notes:
      "Listed in the current catalog. Check the curriculum that applies to your enrollment year.",
  }),
  course("ME 203", "Thermodynamics I", 3, 3),
  course("ME 205", "Statics", 3, 3, {
    minor: true,
    minorGroup: "statics",
    minorApprovalRequired: true,
    notes: sharedNote,
  }),
  course("METE 230", "Fundamentals of Materials Science and Engineering", 3, 3),
  course("MATH 219", "Introduction to Differential Equations", 4, 3),
  course(
    "EE 209",
    "Fundamentals of Electrical and Electronics Engineering",
    3,
    3,
    {
      notes:
        "Not an automatic substitute for EE 281 or EE 201 in the published minor course list.",
    },
  ),
  course("ENG 211", "Academic Speaking Skills", 3, 3),
  course("HIST 2201", "History of the Turkish Revolution I", 0, 3, {
    alternatives: ["HIST 2205"],
    notes: "Use the language-track course on your approved curriculum.",
  }),
  course("ME 202", "Manufacturing Technologies", 3, 4),
  course("ME 204", "Thermodynamics II", 3, 4),
  course("ME 206", "Strength of Materials", 3, 4),
  course("ME 208", "Dynamics", 3, 4),
  course("ME 210", "Applied Mathematics for Mechanical Engineers", 3, 4),
  course("HIST 2202", "History of the Turkish Revolution II", 0, 4, {
    alternatives: ["HIST 2206"],
    notes: "Use the language-track course on your approved curriculum.",
  }),
  course("ME 300", "Summer Practice I", 0, 5),
  course("ME 301", "Theory of Machines I", 3, 5),
  course("ME 303", "Manufacturing Engineering", 3, 5),
  course("ME 305", "Fluid Mechanics I", 3, 5),
  course("ME 307", "Machine Elements I", 3, 5),
  course("ME 311", "Heat Transfer", 3, 5),
  course("ECON 210", "Principles of Economics", 3, 5),
  course("TURK 303", "Turkish I", 0, 5, {
    alternatives: ["TURK 105", "TURK 201"],
    notes: "Use the language-track course on your approved curriculum.",
  }),
  course("ME 302", "Theory of Machines II", 3, 6),
  course("ME 304", "Control Systems", 3, 6),
  course("ME 306", "Fluid Mechanics II", 3, 6),
  course("ME 308", "Machine Elements II", 3, 6),
  course("ME 310", "Numerical Methods", 3, 6),
  course("ME 312", "Thermal Engineering", 3, 6),
  course("TURK 304", "Turkish II", 0, 6, {
    alternatives: ["TURK 106", "TURK 202"],
    notes: "Use the language-track course on your approved curriculum.",
  }),
  course("ME 400", "Summer Practice II", 0, 7),
  course("ME 407", "Mechanical Engineering Design", 3, 7),
  course("OHS 301", "Occupational Health and Safety II", 0, 7),
  majorSlot("FREE", "Free elective", 7, "free"),
  majorSlot("NTE1", "Nontechnical elective 1", 7, "nontechnical"),
  majorSlot("TE1", "Technical elective 1", 7, "technical"),
  majorSlot("TE2", "Technical elective 2", 7, "technical"),
  majorSlot("TE3", "Technical elective 3", 7, "technical"),
  course("ME 410", "Mechanical Engineering Systems Laboratory", 3, 8),
  majorSlot("NTE2", "Nontechnical elective 2", 8, "nontechnical"),
  majorSlot(
    "REST",
    "Restricted thermo-fluids design elective",
    8,
    "restricted",
  ),
  majorSlot("TE4", "Technical elective 4", 8, "technical"),
  majorSlot("TE5", "Technical elective 5", 8, "technical"),
  course("ME 220", "Introduction to Mechatronics", 1, null, {
    major: false,
    minor: true,
    kind: "minor-required",
    minorGroup: "introduction",
  }),
  course("EE 281", "Electrical Circuits", 3, null, {
    major: false,
    minor: true,
    kind: "minor-required",
    minorGroup: "circuits",
    alternatives: ["EE 201"],
    notes:
      "EE 201 (4 local credits) is an allowed alternative. EE 209 is not listed as an alternative.",
  }),
  course("ME 462", "Mechatronic Design", 3, null, {
    major: false,
    minor: true,
    kind: "minor-required",
    minorGroup: "design",
  }),
  ...[1, 2, 3, 4].map((number) =>
    course(
      `MINOR_ELECTIVE_${number}`,
      `Mechatronics elective ${number}`,
      3,
      null,
      {
        major: false,
        minor: true,
        kind: "minor-elective",
        placeholder: true,
        notes:
          "Unfilled requirement: select an approved elective outside the major. At least two of the four must be 400-level courses. Three credits is a planning default; some choices have four.",
      },
    ),
  ),
];

export const minorRules = {
  effectiveFrom: "2019-1",
  requiredGroups: 5,
  minimumAdditionalElectives: 4,
  minimumAdditionalCredits: 12,
  minimumUpperLevelElectives: 2,
  upperLevelPrefix: "4",
  minimumGpa: 2,
  sharedApprovalRequired: true,
  notes: [
    "Use a separate GPA for the minor. Shared courses enter each program only when formally counted there.",
    "Four minor electives must be distinct from courses counted in the major; at least two must have a 4xx code.",
    "ME 205 and CENG 240 are possible shared compulsory courses, not automatic exemptions. Confirm their minor counting.",
    "The listed ME 202, ME 206, ME 208, ME 301, ME 302, ME 307 and ME 308 cannot fill the four additional electives when counted in the Mechanical Engineering major.",
    "The default nine-course minor template totals 25 local credits, including six potentially shared credits. EE 201 or four-credit electives change this total.",
    "Unfilled elective slots, prerequisites, quotas, course availability and advisor approval must be resolved separately.",
  ],
};

const option = (code, name, credits = 3, extra = {}) => ({
  id: code.replace(/\s/g, ""),
  code,
  name,
  credits,
  ...extra,
});

export const minorRequiredAlternatives = {
  introduction: [option("ME 220", "Introduction to Mechatronics", 1)],
  circuits: [
    option("EE 281", "Electrical Circuits"),
    option("EE 201", "Circuit Theory I", 4),
  ],
  statics: [
    option("ME 205", "Statics"),
    option("CE 221", "Engineering Mechanics I"),
    option("AE 261", "Statics"),
  ],
  programming: [
    option("CENG 240", "Programming with Python for Engineers"),
    option("CENG 229", "C Programming", 4),
  ],
  design: [option("ME 462", "Mechatronic Design")],
};

// A listing does not guarantee current offering. majorRequired choices cannot
// be reused for the four extra minor electives by an ME student.
export const minorOptions = [
  option("ME 301", "Theory of Machines I", 3, { majorRequired: true }),
  option("ME 302", "Theory of Machines II", 3, { majorRequired: true }),
  option("ME 307", "Machine Elements I", 3, { majorRequired: true }),
  option("ME 308", "Machine Elements II", 3, { majorRequired: true }),
  option("ME 208", "Dynamics", 3, { majorRequired: true }),
  option("ME 206", "Strength of Materials", 3, { majorRequired: true }),
  option("ME 202", "Manufacturing Technologies", 3, { majorRequired: true }),
  option("ME 413", "Introduction to Finite Element Analysis"),
  option("ME 418", "Dynamics of Machinery"),
  option("ME 429", "Mechanical Vibrations"),
  option("ME 431", "Kinematic Synthesis of Mechanisms"),
  option("ME 432", "Acoustics and Noise Control Engineering"),
  option("ME 440", "Numerical Machine Control"),
  option("ME 442", "Design of Control Systems"),
  option("ME 461", "Mechatronic Components and Instrumentation"),
  option("ME 493", "Introduction to Smart Structures and Materials"),
  option(
    "ME 448",
    "Fundamentals of Micro Electromechanical Systems and Microsystems",
  ),
  option("EE 202", "Circuit Theory II", 4),
  option("EE 230", "Probability"),
  option("EE 301", "Signals and Systems I"),
  option("EE 361", "Electromechanical Energy Conversion I", 4),
  option("EE 302", "Feedback Systems"),
  option("EE 348", "Introduction to Logic Design"),
  option("EE 402", "Discrete-Time Systems"),
  option("EE 404", "Nonlinear Control Systems"),
  option("EE 406", "Laboratory of Feedback Control Systems"),
  option("EE 430", "Discrete-Time Signal Processing"),
  option("EE 447", "Introduction to Microprocessors", 4),
  option("EE 499", "Vector Space Methods in Signal Processing"),
  option("EE 498", "Control System Design and Simulation"),
  option("CENG 213", "Data Structures", 4),
  option("CENG 222", "Statistics"),
  option("CENG 232", "Logic Design", 4),
  option("CENG 242", "Programming Languages", 4),
  option("CENG 280", "Formal Languages"),
  option("CENG 301", "Algorithms and Data Structures"),
  option("CENG 334", "Operating Systems"),
  option("CENG 336", "Introduction to Embedded Systems Development"),
  option("CENG 384", "Signals and Systems for Computer Engineers"),
  option("CENG 424", "Logic for Computer Sciences"),
  option("CENG 443", "Introduction to Object Oriented Programming and Systems"),
  option("CENG 460", "Introduction to Robotics"),
  option("CENG 462", "Introduction to Artificial Intelligence"),
  option("CENG 466", "Fundamental Image Processing Techniques"),
  option("CENG 499", "Introduction to Machine Learning"),
];

export const restrictedOptions = [
  "ME 403",
  "ME 405",
  "ME 421",
  "ME 426",
  "ME 437",
  "ME 476",
  "ME 481",
  "ME 492",
  "ME 496",
];

export const curriculumNotes = [
  "This blank template has 44 credited major requirements (141 local credits with three-credit elective defaults) and 10 noncredit requirements. It contains no personal grades.",
  "The department separates five technical electives and one restricted elective. The catalog groups all six as technical electives. The department registration guide retains the restricted design-course requirement.",
  "BA 100 and OHS 301 come from the current academic catalog. Enrollment-year adaptations and approved exemptions may change an individual checklist.",
  "Semester numbers show curriculum order. Course offering, prerequisites, surname sections, timetable conflicts and quotas require the live university registration system.",
  "The previous app surname groups are not verified current requirements; course scheduling can be edited without changing the degree requirements.",
];
