// METU ME GPA Calculator - Main Application Logic

// State to store grades and surname group
let grades = {};
let currentGroup = 'A';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    updateCurriculum();
    renderSemesters();
    updateGPA();

    // Listen for semester changes
    document.getElementById('currentSemester').addEventListener('change', (e) => {
        renderSemesters();
        updateGPA();
    });

    // Listen for surname group changes
    document.getElementById('groupA').addEventListener('click', () => {
        if (currentGroup !== 'A') {
            currentGroup = 'A';
            updateGroupButtons();
            updateCurriculum();
            renderSemesters();
            updateGPA();
            saveToLocalStorage();
        }
    });

    document.getElementById('groupB').addEventListener('click', () => {
        if (currentGroup !== 'B') {
            currentGroup = 'B';
            updateGroupButtons();
            updateCurriculum();
            renderSemesters();
            updateGPA();
            saveToLocalStorage();
        }
    });
});

// Update curriculum based on selected group
function updateCurriculum() {
    curriculum = getCurriculum(currentGroup);
}

// Update active state on group buttons
function updateGroupButtons() {
    document.getElementById('groupA').classList.toggle('active', currentGroup === 'A');
    document.getElementById('groupB').classList.toggle('active', currentGroup === 'B');
}

// Load grades and settings from localStorage
function loadFromLocalStorage() {
    const savedGrades = localStorage.getItem('metuMeGrades');
    if (savedGrades) {
        grades = JSON.parse(savedGrades);
    }
    const savedGroup = localStorage.getItem('metuMeSurnameGroup');
    if (savedGroup) {
        currentGroup = savedGroup;
        updateGroupButtons();
    }
}

// Save grades and settings to localStorage
function saveToLocalStorage() {
    localStorage.setItem('metuMeGrades', JSON.stringify(grades));
    localStorage.setItem('metuMeSurnameGroup', currentGroup);
}

// Get current semester selection
function getCurrentSemester() {
    return parseInt(document.getElementById('currentSemester').value);
}

// Render all visible semesters
function renderSemesters() {
    const container = document.getElementById('semesters-container');
    const currentSem = getCurrentSemester();

    container.innerHTML = '';

    for (let sem = 1; sem <= currentSem; sem++) {
        container.appendChild(createSemesterCard(sem));
    }
}

// Create a semester card element
function createSemesterCard(semesterNum) {
    const semData = curriculum[semesterNum];
    const card = document.createElement('div');
    card.className = 'semester-card';
    card.style.opacity = '0';

    // Calculate semester stats
    const stats = calculateSemesterGPA(semesterNum);

    card.innerHTML = `
        <div class="semester-header">
            <h2>${semData.name}</h2>
            <div class="semester-stats">
                <span>Credits: ${stats.totalCredits}</span>
                <span>GPA: ${stats.gpa.toFixed(2)}</span>
            </div>
        </div>
        <table class="course-table">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Course Name</th>
                    <th>Credits</th>
                    <th>Grade</th>
                </tr>
            </thead>
            <tbody>
                ${semData.courses.map(course => createCourseRow(semesterNum, course)).join('')}
            </tbody>
        </table>
    `;

    // Trigger animation
    setTimeout(() => {
        card.style.opacity = '1';
    }, 10);

    return card;
}

// Create a course row HTML
function createCourseRow(semesterNum, course) {
    const gradeKey = `${semesterNum}-${course.code}`;
    const currentGrade = grades[gradeKey] || 'N/A';
    const gradeClass = `grade-${currentGrade.toLowerCase().replace('/', '')}`;

    return `
        <tr>
            <td class="course-code">${course.code}</td>
            <td class="course-name">${course.name}</td>
            <td class="course-credits">${course.credits}</td>
            <td>
                <select class="grade-select ${gradeClass}" 
                        data-semester="${semesterNum}" 
                        data-code="${course.code}"
                        onchange="handleGradeChange(this)">
                    ${gradeOptions.map(grade =>
        `<option value="${grade}" ${grade === currentGrade ? 'selected' : ''}>${grade}</option>`
    ).join('')}
                </select>
            </td>
        </tr>
    `;
}

// Handle grade changes
function handleGradeChange(selectElement) {
    const semester = selectElement.dataset.semester;
    const code = selectElement.dataset.code;
    const grade = selectElement.value;
    const gradeKey = `${semester}-${code}`;

    // Update state
    if (grade === 'N/A') {
        delete grades[gradeKey];
    } else {
        grades[gradeKey] = grade;
    }

    // Update select styling
    selectElement.className = 'grade-select';
    selectElement.classList.add(`grade-${grade.toLowerCase().replace('/', '')}`);

    // Save and recalculate
    saveToLocalStorage();
    updateGPA();
    updateSemesterStats(parseInt(semester));
}

// Calculate GPA for a specific semester
function calculateSemesterGPA(semesterNum) {
    const semData = curriculum[semesterNum];
    let totalPoints = 0;
    let totalCredits = 0;
    let gradedCredits = 0;

    semData.courses.forEach(course => {
        totalCredits += course.credits;

        const gradeKey = `${semesterNum}-${course.code}`;
        const grade = grades[gradeKey];

        if (grade && grade !== 'N/A' && gradePoints[grade] !== undefined) {
            totalPoints += gradePoints[grade] * course.credits;
            gradedCredits += course.credits;
        }
    });

    return {
        gpa: gradedCredits > 0 ? totalPoints / gradedCredits : 0,
        totalCredits: totalCredits,
        gradedCredits: gradedCredits,
        totalPoints: totalPoints
    };
}

// Calculate cumulative GPA across all visible semesters
function calculateCumulativeGPA() {
    const currentSem = getCurrentSemester();
    let totalPoints = 0;
    let totalCredits = 0;
    let allCredits = 0;

    for (let sem = 1; sem <= currentSem; sem++) {
        const stats = calculateSemesterGPA(sem);
        totalPoints += stats.totalPoints;
        totalCredits += stats.gradedCredits;
        allCredits += stats.totalCredits;
    }

    return {
        cgpa: totalCredits > 0 ? totalPoints / totalCredits : 0,
        totalCredits: allCredits,
        gradedCredits: totalCredits
    };
}

// Update the main GPA display
function updateGPA() {
    const cumStats = calculateCumulativeGPA();

    document.getElementById('cgpa').textContent = cumStats.cgpa.toFixed(2);
    document.getElementById('totalCredits').textContent = cumStats.gradedCredits + ' / ' + cumStats.totalCredits;
}

// Update semester stats in the header
function updateSemesterStats(semesterNum) {
    const cards = document.querySelectorAll('.semester-card');
    const card = cards[semesterNum - 1];

    if (card) {
        const stats = calculateSemesterGPA(semesterNum);
        const statsContainer = card.querySelector('.semester-stats');
        statsContainer.innerHTML = `
            <span>Credits: ${stats.totalCredits}</span>
            <span>GPA: ${stats.gpa.toFixed(2)}</span>
        `;
    }
}
