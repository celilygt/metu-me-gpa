// METU Mechanical Engineering Curriculum Data
// Based on the official curriculum from me.metu.edu.tr
// Note: ME 117, ME 110, and METE 230 are offered in alternating semesters based on surname

// Curriculum for students with surnames A-KA (Group 1)
const curriculumGroupA = {
    1: {
        name: "1st Semester",
        courses: [
            { code: "ME 117", name: "Computer Aided Engineering Drawing", credits: 3 },
            { code: "MATH 119", name: "Calculus with Analytic Geometry", credits: 5 },
            { code: "PHYS 105", name: "General Physics I", credits: 4 },
            { code: "CENG 240", name: "Programming with Python for Engineers", credits: 3 },
            { code: "ENG 101", name: "English for Academic Purposes I", credits: 4 }
        ]
    },
    2: {
        name: "2nd Semester",
        courses: [
            { code: "ME 110", name: "Introduction to Mechanical Engineering", credits: 2 },
            { code: "MATH 120", name: "Calculus for Functions of Several Variables", credits: 5 },
            { code: "PHYS 106", name: "General Physics II", credits: 4 },
            { code: "CHEM 107", name: "General Chemistry", credits: 4 },
            { code: "ENG 102", name: "English for Academic Purposes II", credits: 4 }
        ]
    },
    3: {
        name: "3rd Semester",
        courses: [
            { code: "ME 203", name: "Thermodynamics I", credits: 3 },
            { code: "ME 205", name: "Statics", credits: 3 },
            { code: "METE 230", name: "Fundamentals of Material Science and Engineering", credits: 3 },
            { code: "MATH 219", name: "Introduction to Differential Equations", credits: 4 },
            { code: "EE 209", name: "Fundamentals of Electrical and Electronics Engineering", credits: 3 },
            { code: "ENG 211", name: "Academic Oral Presentation Skills", credits: 3 }
        ]
    },
    4: {
        name: "4th Semester",
        courses: [
            { code: "ME 202", name: "Manufacturing Technologies", credits: 3 },
            { code: "ME 204", name: "Thermodynamics II", credits: 3 },
            { code: "ME 206", name: "Strength of Materials", credits: 3 },
            { code: "ME 208", name: "Dynamics", credits: 3 },
            { code: "ME 210", name: "Applied Mathematics for Mechanical Engineers", credits: 3 }
        ]
    },
    5: {
        name: "5th Semester",
        courses: [
            { code: "ME 301", name: "Theory of Machines I", credits: 3 },
            { code: "ME 303", name: "Manufacturing Engineering", credits: 3 },
            { code: "ME 305", name: "Fluid Mechanics I", credits: 3 },
            { code: "ME 307", name: "Machine Elements I", credits: 3 },
            { code: "ME 311", name: "Heat Transfer", credits: 3 },
            { code: "ECON 210", name: "Principles of Economics", credits: 3 }
        ]
    },
    6: {
        name: "6th Semester",
        courses: [
            { code: "ME 302", name: "Theory of Machines II", credits: 3 },
            { code: "ME 304", name: "Control Systems", credits: 3 },
            { code: "ME 306", name: "Fluid Mechanics II", credits: 3 },
            { code: "ME 308", name: "Machine Elements II", credits: 3 },
            { code: "ME 310", name: "Numerical Methods", credits: 3 },
            { code: "ME 312", name: "Thermal Engineering", credits: 3 }
        ]
    },
    7: {
        name: "7th Semester",
        courses: [
            { code: "ME 407", name: "Mechanical Engineering Design", credits: 3 },
            { code: "FREE", name: "Free Elective", credits: 3 },
            { code: "NTE 1", name: "Nontechnical Elective", credits: 3 },
            { code: "TE 1", name: "Technical Elective", credits: 3 },
            { code: "TE 2", name: "Technical Elective", credits: 3 },
            { code: "TE 3", name: "Technical Elective", credits: 3 }
        ]
    },
    8: {
        name: "8th Semester",
        courses: [
            { code: "ME 410", name: "Mechanical Engineering Systems Laboratory", credits: 3 },
            { code: "NTE 2", name: "Nontechnical Elective", credits: 3 },
            { code: "REST", name: "Restricted Elective", credits: 3 },
            { code: "TE 4", name: "Technical Elective", credits: 3 },
            { code: "TE 5", name: "Technical Elective", credits: 3 }
        ]
    }
};

// Curriculum for students with surnames KA-Z (Group 2)
// ME 117 and ME 110 are swapped, and METE 230 moves to 4th semester
const curriculumGroupB = {
    1: {
        name: "1st Semester",
        courses: [
            { code: "ME 110", name: "Introduction to Mechanical Engineering", credits: 2 },
            { code: "MATH 119", name: "Calculus with Analytic Geometry", credits: 5 },
            { code: "PHYS 105", name: "General Physics I", credits: 4 },
            { code: "CENG 240", name: "Programming with Python for Engineers", credits: 3 },
            { code: "ENG 101", name: "English for Academic Purposes I", credits: 4 }
        ]
    },
    2: {
        name: "2nd Semester",
        courses: [
            { code: "ME 117", name: "Computer Aided Engineering Drawing", credits: 3 },
            { code: "MATH 120", name: "Calculus for Functions of Several Variables", credits: 5 },
            { code: "PHYS 106", name: "General Physics II", credits: 4 },
            { code: "CHEM 107", name: "General Chemistry", credits: 4 },
            { code: "ENG 102", name: "English for Academic Purposes II", credits: 4 }
        ]
    },
    3: {
        name: "3rd Semester",
        courses: [
            { code: "ME 203", name: "Thermodynamics I", credits: 3 },
            { code: "ME 205", name: "Statics", credits: 3 },
            { code: "MATH 219", name: "Introduction to Differential Equations", credits: 4 },
            { code: "EE 209", name: "Fundamentals of Electrical and Electronics Engineering", credits: 3 },
            { code: "ENG 211", name: "Academic Oral Presentation Skills", credits: 3 }
        ]
    },
    4: {
        name: "4th Semester",
        courses: [
            { code: "ME 202", name: "Manufacturing Technologies", credits: 3 },
            { code: "ME 204", name: "Thermodynamics II", credits: 3 },
            { code: "ME 206", name: "Strength of Materials", credits: 3 },
            { code: "ME 208", name: "Dynamics", credits: 3 },
            { code: "ME 210", name: "Applied Mathematics for Mechanical Engineers", credits: 3 },
            { code: "METE 230", name: "Fundamentals of Material Science and Engineering", credits: 3 }
        ]
    },
    5: {
        name: "5th Semester",
        courses: [
            { code: "ME 301", name: "Theory of Machines I", credits: 3 },
            { code: "ME 303", name: "Manufacturing Engineering", credits: 3 },
            { code: "ME 305", name: "Fluid Mechanics I", credits: 3 },
            { code: "ME 307", name: "Machine Elements I", credits: 3 },
            { code: "ME 311", name: "Heat Transfer", credits: 3 },
            { code: "ECON 210", name: "Principles of Economics", credits: 3 }
        ]
    },
    6: {
        name: "6th Semester",
        courses: [
            { code: "ME 302", name: "Theory of Machines II", credits: 3 },
            { code: "ME 304", name: "Control Systems", credits: 3 },
            { code: "ME 306", name: "Fluid Mechanics II", credits: 3 },
            { code: "ME 308", name: "Machine Elements II", credits: 3 },
            { code: "ME 310", name: "Numerical Methods", credits: 3 },
            { code: "ME 312", name: "Thermal Engineering", credits: 3 }
        ]
    },
    7: {
        name: "7th Semester",
        courses: [
            { code: "ME 407", name: "Mechanical Engineering Design", credits: 3 },
            { code: "FREE", name: "Free Elective", credits: 3 },
            { code: "NTE 1", name: "Nontechnical Elective", credits: 3 },
            { code: "TE 1", name: "Technical Elective", credits: 3 },
            { code: "TE 2", name: "Technical Elective", credits: 3 },
            { code: "TE 3", name: "Technical Elective", credits: 3 }
        ]
    },
    8: {
        name: "8th Semester",
        courses: [
            { code: "ME 410", name: "Mechanical Engineering Systems Laboratory", credits: 3 },
            { code: "NTE 2", name: "Nontechnical Elective", credits: 3 },
            { code: "REST", name: "Restricted Elective", credits: 3 },
            { code: "TE 4", name: "Technical Elective", credits: 3 },
            { code: "TE 5", name: "Technical Elective", credits: 3 }
        ]
    }
};

// Default curriculum (will be set based on surname group selection)
let curriculum = curriculumGroupA;

// Function to get curriculum based on group
function getCurriculum(group) {
    return group === 'A' ? curriculumGroupA : curriculumGroupB;
}

// Grading scheme: grade -> points
const gradePoints = {
    "AA": 4.00,
    "BA": 3.50,
    "BB": 3.00,
    "CB": 2.50,
    "CC": 2.00,
    "DC": 1.50,
    "DD": 1.00,
    "FD": 0.50,
    "FF": 0.00
};

const gradeOptions = ["N/A", "AA", "BA", "BB", "CB", "CC", "DC", "DD", "FD", "FF"];
