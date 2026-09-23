/**
 * Pure GPA planning calculations. Credits are METU local credits, not ECTS.
 * Each course is counted once. A planned repeat replaces its previous result,
 * including when the new result is lower. No rounding is applied internally.
 */
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
export const GRADE_POINTS = gradePoints;
export const letterGrades = Object.freeze(Object.keys(gradePoints));
export const allGrades = Object.freeze([
  "",
  ...letterGrades,
  "S",
  "U",
  "EX",
  "I",
  "W",
]);

const passFailGrades = new Set(["S", "U", "EX"]);
const acceptedGrades = new Set(allGrades);
const EPSILON = 1e-9;
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function validGrade(grade) {
  if (!acceptedGrades.has(grade))
    throw new RangeError(`Unknown grade: ${String(grade)}`);
  return grade;
}

export function isPassed(grade = "") {
  validGrade(grade);
  return (
    grade === "S" ||
    grade === "EX" ||
    (has(gradePoints, grade) && gradePoints[grade] >= 1)
  );
}

function selectedCourses(courses, program) {
  if (!Array.isArray(courses)) throw new TypeError("Courses must be an array.");
  if (!["major", "minor", "all"].includes(program))
    throw new RangeError("Unknown program.");
  const ids = new Set();
  for (const course of courses) {
    if (!course || typeof course.id !== "string" || !course.id)
      throw new TypeError("Each course needs an id.");
    if (ids.has(course.id))
      throw new RangeError(`Duplicate course id: ${course.id}`);
    ids.add(course.id);
    if (
      typeof course.credits !== "number" ||
      !Number.isFinite(course.credits) ||
      course.credits < 0
    ) {
      throw new RangeError(`Invalid credits for ${course.code || course.id}.`);
    }
  }
  return courses.filter(
    (course) => program === "all" || course[program] === true,
  );
}

function gpaCourse(course) {
  return course.credits > 0 && course.gpa !== false;
}

/** Return a checked distribution; invalid totals are never normalized. */
export function validateDistribution(distribution) {
  if (
    !distribution ||
    typeof distribution !== "object" ||
    Array.isArray(distribution)
  ) {
    throw new TypeError("Grade probabilities must be an object.");
  }
  const entries = Object.entries(distribution);
  let total = 0;
  let expectedPoints = 0;
  let passProbability = 0;
  for (const [grade, percent] of entries) {
    if (!has(gradePoints, grade))
      throw new RangeError(
        `Probabilities require a numeric letter grade: ${grade}`,
      );
    if (
      typeof percent !== "number" ||
      !Number.isFinite(percent) ||
      percent < 0 ||
      percent > 100
    ) {
      throw new RangeError(
        `Probability for ${grade} must be between 0 and 100.`,
      );
    }
    total += percent;
    expectedPoints += (gradePoints[grade] * percent) / 100;
    if (isPassed(grade)) passProbability += percent / 100;
  }
  if (Math.abs(total - 100) > EPSILON)
    throw new RangeError(
      `Grade probabilities must total 100% (currently ${total}%).`,
    );
  return {
    total,
    expectedPoints,
    passProbability,
    entries: entries.filter(([, percent]) => percent > 0),
  };
}

function gradeOutcome(course, grade = "") {
  validGrade(grade);
  return {
    points:
      gpaCourse(course) && has(gradePoints, grade)
        ? gradePoints[grade] * course.credits
        : 0,
    gpaCredits:
      gpaCourse(course) && has(gradePoints, grade) ? course.credits : 0,
    passProbability: isPassed(grade) ? 1 : 0,
  };
}

function plannedOutcome(course, plan) {
  if (plan === undefined || plan === null) return null;
  if (typeof plan !== "object" || Array.isArray(plan))
    throw new TypeError(`Invalid plan for ${course.code || course.id}.`);
  if (plan.distribution !== undefined && plan.distribution !== null) {
    const distribution = validateDistribution(plan.distribution);
    return {
      points: gpaCourse(course)
        ? distribution.expectedPoints * course.credits
        : 0,
      gpaCredits: gpaCourse(course) ? course.credits : 0,
      passProbability: distribution.passProbability,
      distribution,
    };
  }
  const grade = plan.grade ?? "";
  validGrade(grade);
  if (grade === "" || grade === "I" || grade === "W") return null;
  return gradeOutcome(course, grade);
}

function summarize(courses, outcomeForCourse) {
  const result = {
    gpa: null,
    totalPoints: 0,
    gpaCredits: 0,
    earnedCredits: 0,
    requiredCredits: 0,
    passedCount: 0,
    totalCount: courses.length,
    remainingCredits: 0,
    remainingCount: 0,
  };
  for (const course of courses) {
    const outcome = outcomeForCourse(course);
    result.totalPoints += outcome.points;
    result.gpaCredits += outcome.gpaCredits;
    result.requiredCredits += course.credits;
    result.earnedCredits += course.credits * outcome.passProbability;
    result.passedCount += outcome.passProbability;
  }
  if (result.gpaCredits > 0)
    result.gpa = result.totalPoints / result.gpaCredits;
  result.remainingCredits = Math.max(
    0,
    result.requiredCredits - result.earnedCredits,
  );
  result.remainingCount = Math.max(0, result.totalCount - result.passedCount);
  return result;
}

/** Actual transcript only. Failing attempts affect GPA but earn no credits. */
export function stats(courses, grades = {}, program = "major") {
  return summarize(selectedCourses(courses, program), (course) =>
    gradeOutcome(course, grades[course.id] ?? ""),
  );
}

/** Scenario results replace actual results per course; an empty plan changes nothing. */
export function project(
  courses,
  transcript = {},
  scenario = {},
  program = "major",
) {
  const relevant = selectedCourses(courses, program);
  const plans = scenario?.courses ?? {};
  let plannedCount = 0;
  let plannedCredits = 0;
  let remainingUnplanned = 0;
  let remainingUnplannedCredits = 0;
  const result = summarize(relevant, (course) => {
    const actual = gradeOutcome(course, transcript[course.id] ?? "");
    const plan = plannedOutcome(course, plans[course.id]);
    if (plan) {
      plannedCount += 1;
      plannedCredits += course.credits;
      return plan;
    }
    if (!actual.passProbability) {
      remainingUnplanned += 1;
      remainingUnplannedCredits += course.credits;
    }
    return actual;
  });
  return {
    ...result,
    plannedCount,
    plannedCredits,
    remainingUnplanned,
    remainingUnplannedCredits,
  };
}

function validTarget(target) {
  if (
    typeof target !== "number" ||
    !Number.isFinite(target) ||
    target < 0 ||
    target > 4
  ) {
    throw new RangeError("Target GPA must be between 0 and 4.");
  }
}

/**
 * Solve the average needed on unfinished courses that have no selected plan.
 * An existing failed attempt is removed before its eventual replacement is added.
 * Selected failed outcomes stay fixed: an additional repeat is not silently assumed.
 * requiredAverage uses expected planned points; min/max and status use the full
 * support of selected distributions, so an uncertain success is never guaranteed.
 */
export function targetRequirement(
  courses,
  transcript = {},
  scenario = {},
  target,
  program = "major",
) {
  validTarget(target);
  const relevant = selectedCourses(courses, program);
  const projection = project(courses, transcript, scenario, program);
  const plans = scenario?.courses ?? {};
  let fixedPoints = projection.totalPoints;
  let fixedMinPoints = projection.totalPoints;
  let fixedMaxPoints = projection.totalPoints;
  let fixedCredits = projection.gpaCredits;
  let remainingCredits = 0;
  let remainingCount = 0;
  let outstandingFailures = 0;
  let pendingNonGpaCount = 0;
  let hasUncertainty = false;
  for (const course of relevant) {
    const grade = transcript[course.id] ?? "";
    const plan = plannedOutcome(course, plans[course.id]);
    if (plan) {
      if (plan.passProbability < 1 - EPSILON) outstandingFailures += 1;
      if (plan.distribution && plan.gpaCredits > 0) {
        const possiblePoints = plan.distribution.entries.map(
          ([letter]) => gradePoints[letter] * course.credits,
        );
        const lowest = Math.min(...possiblePoints);
        const highest = Math.max(...possiblePoints);
        fixedMinPoints += lowest - plan.points;
        fixedMaxPoints += highest - plan.points;
        hasUncertainty ||= highest > lowest;
      }
      continue;
    }
    if (isPassed(grade)) continue;
    if (!gpaCourse(course) || passFailGrades.has(grade)) {
      pendingNonGpaCount += 1;
      continue;
    }
    const current = gradeOutcome(course, grade);
    fixedPoints -= current.points;
    fixedMinPoints -= current.points;
    fixedMaxPoints -= current.points;
    fixedCredits -= current.gpaCredits;
    remainingCredits += course.credits;
    remainingCount += 1;
  }
  const finalCredits = fixedCredits + remainingCredits;
  const minGpa = finalCredits > 0 ? fixedMinPoints / finalCredits : null;
  const maxGpa =
    finalCredits > 0
      ? (fixedMaxPoints + remainingCredits * 4) / finalCredits
      : null;
  const expectedMinGpa = finalCredits > 0 ? fixedPoints / finalCredits : null;
  const expectedMaxGpa =
    finalCredits > 0
      ? (fixedPoints + remainingCredits * 4) / finalCredits
      : null;
  const requiredAverage =
    remainingCredits > 0
      ? (target * finalCredits - fixedPoints) / remainingCredits
      : null;
  const requiredAverageBestCase =
    remainingCredits > 0
      ? (target * finalCredits - fixedMaxPoints) / remainingCredits
      : null;
  const requiredAverageWorstCase =
    remainingCredits > 0
      ? (target * finalCredits - fixedMinPoints) / remainingCredits
      : null;
  const possible = maxGpa !== null && maxGpa + EPSILON >= target;
  const secured = minGpa !== null && minGpa + EPSILON >= target;
  const status =
    finalCredits === 0
      ? "needs-plan"
      : secured
        ? "reached"
        : possible
          ? "possible"
          : "impossible";
  return {
    target,
    requiredAverage,
    remainingCredits,
    remainingCount,
    finalCredits,
    fixedPoints,
    fixedCredits,
    projectedGpa: projection.gpa,
    minGpa,
    maxGpa,
    expectedMinGpa,
    expectedMaxGpa,
    hasUncertainty,
    requiredAverageBestCase,
    requiredAverageWorstCase,
    possible,
    status,
    outstandingFailures,
    pendingNonGpaCount,
  };
}

/** Compare the chosen repeat with its actual grade, keeping all other plans fixed. */
export function retakeImpact(
  courses,
  transcript = {},
  courseId,
  newGrade,
  scenario = {},
  program = "major",
) {
  validGrade(newGrade);
  const relevant = selectedCourses(courses, program);
  const course = relevant.find((item) => item.id === courseId);
  if (!course)
    throw new RangeError("The repeat course is not in this program.");
  if (!has(gradePoints, newGrade))
    throw new RangeError("Select a numeric letter grade for the repeat.");
  const current = stats(courses, transcript, program);
  const immediate = stats(
    courses,
    { ...transcript, [courseId]: newGrade },
    program,
  );
  const otherPlans = { ...(scenario?.courses ?? {}) };
  delete otherPlans[courseId];
  const baseline = project(
    courses,
    transcript,
    { ...scenario, courses: otherPlans },
    program,
  );
  const projected = project(
    courses,
    transcript,
    {
      ...scenario,
      courses: { ...otherPlans, [courseId]: { grade: newGrade } },
    },
    program,
  );
  return {
    currentGpa: current.gpa,
    immediateGpa: immediate.gpa,
    immediateDelta:
      current.gpa === null || immediate.gpa === null
        ? null
        : immediate.gpa - current.gpa,
    projectedBaselineGpa: baseline.gpa,
    projectedGpa: projected.gpa,
    projectedDelta:
      baseline.gpa === null || projected.gpa === null
        ? null
        : projected.gpa - baseline.gpa,
    pointGain: immediate.totalPoints - current.totalPoints,
    projectedCredits: projected.gpaCredits,
    projectedRemainingCount: projected.remainingCount,
  };
}

/**
 * A chronological attempt timeline. Semester GPA uses that semester's attempts;
 * cumulative GPA uses each course's latest result as of the end of the semester.
 * Unplanned course cards are visible but contribute neither points nor credits.
 */
export function semesterForecast(
  courses,
  transcript = {},
  scenario = {},
  { currentSemester = 5, graduationSemester = 10 } = {},
) {
  selectedCourses(courses, "all");
  const validTerm = (value) =>
    Number.isInteger(value) && value >= 1 && value <= 12;
  if (!validTerm(currentSemester) || !validTerm(graduationSemester)) {
    throw new RangeError(
      "Current and graduation semesters must be integers from 1 to 12.",
    );
  }
  const plans = scenario?.courses ?? {};
  const byTerm = new Map();
  let lastTerm = Math.max(currentSemester, graduationSemester);
  const add = (term, course, event) => {
    if (!byTerm.has(term)) byTerm.set(term, new Map());
    // A same-term replacement retains only the final attempt for both GPAs.
    byTerm.get(term).set(course.id, { course, ...event });
    lastTerm = Math.max(lastTerm, term);
  };
  for (const course of courses) {
    const actualGrade = validGrade(transcript[course.id] ?? "");
    const actualTerm =
      course.semester == null ? currentSemester : course.semester;
    if (!validTerm(actualTerm))
      throw new RangeError(`Invalid semester for ${course.code || course.id}.`);
    const plan = plans[course.id];
    const outcome = plannedOutcome(course, plan);
    const hasActual = actualGrade !== "";
    if (hasActual) {
      add(actualTerm, course, {
        grade: actualGrade,
        planned: false,
        repeat: false,
        outcome: gradeOutcome(course, actualGrade),
      });
    }
    if (outcome) {
      const plannedTerm = plan.term ?? currentSemester;
      if (!validTerm(plannedTerm))
        throw new RangeError(
          `Invalid planned semester for ${course.code || course.id}.`,
        );
      add(plannedTerm, course, {
        grade: plan.grade ?? "",
        planned: true,
        repeat: hasActual,
        distribution: plan.distribution ?? null,
        expectedGradePoints:
          outcome.gpaCredits > 0 ? outcome.points / outcome.gpaCredits : null,
        outcome,
      });
    } else if (!hasActual) {
      const placement = plan?.term ?? actualTerm;
      if (!validTerm(placement))
        throw new RangeError(
          `Invalid planned semester for ${course.code || course.id}.`,
        );
      add(placement, course, {
        grade: "",
        planned: false,
        repeat: false,
        outcome: null,
      });
    }
  }
  const latest = new Map();
  const rows = [];
  for (let term = 1; term <= lastTerm; term += 1) {
    const events = [...(byTerm.get(term)?.values() ?? [])];
    for (const event of events)
      if (event.outcome) latest.set(event.course.id, event);
    const summary = (program) => {
      const semesterEvents = events.filter(
        (event) => event.course[program] === true && event.outcome,
      );
      const cumulativeEvents = [...latest.values()].filter(
        (event) => event.course[program] === true,
      );
      const semester = summarize(
        semesterEvents.map((event) => event.course),
        (course) => byTerm.get(term).get(course.id).outcome,
      );
      const cumulative = summarize(
        cumulativeEvents.map((event) => event.course),
        (course) => latest.get(course.id).outcome,
      );
      return {
        semesterGpa: semester.gpa,
        cumulativeGpa: cumulative.gpa,
        semesterCredits: semester.gpaCredits,
        earnedCredits: cumulative.earnedCredits,
        cumulativeCredits: cumulative.gpaCredits,
        semesterEarnedCredits: semester.earnedCredits,
        semesterAttemptedCredits: semesterEvents.reduce(
          (total, event) => total + event.course.credits,
          0,
        ),
        cumulativeEarnedCredits: cumulative.earnedCredits,
        semesterPoints: semester.totalPoints,
        cumulativePoints: cumulative.totalPoints,
      };
    };
    rows.push({
      term,
      major: summary("major"),
      minor: summary("minor"),
      courses: events.map(({ course, outcome, ...event }) => ({
        id: course.id,
        ...event,
      })),
    });
  }
  return rows;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomGenerator(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted, fraction) {
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  return (
    sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower)
  );
}

/** Independent course outcomes, using user-supplied beliefs rather than predictions. */
export function probabilityForecast(
  courses,
  transcript = {},
  scenario = {},
  target,
  program = "major",
  samples = 4000,
) {
  validTarget(target);
  if (!Number.isInteger(samples) || samples < 1 || samples > 100000)
    throw new RangeError("Samples must be an integer from 1 to 100000.");
  const relevant = selectedCourses(courses, program);
  const projection = project(courses, transcript, scenario, program);
  const plans = scenario?.courses ?? {};
  const uncertain = [];
  let fixedPoints = projection.totalPoints;
  for (const course of relevant) {
    const outcome = plannedOutcome(course, plans[course.id]);
    if (
      !outcome?.distribution ||
      outcome.distribution.entries.length < 2 ||
      !gpaCourse(course)
    )
      continue;
    fixedPoints -= outcome.points;
    uncertain.push({
      id: course.id,
      credits: course.credits,
      entries: outcome.distribution.entries,
    });
  }
  if (projection.gpa === null) {
    return {
      expectedGpa: null,
      p10: null,
      p50: null,
      p90: null,
      chance: null,
      samples: 0,
      uncertainCount: 0,
    };
  }
  if (!uncertain.length) {
    return {
      expectedGpa: projection.gpa,
      p10: projection.gpa,
      p50: projection.gpa,
      p90: projection.gpa,
      chance: projection.gpa + EPSILON >= target ? 1 : 0,
      samples,
      uncertainCount: 0,
    };
  }
  const random = randomGenerator(
    hashSeed(
      JSON.stringify({
        fixedPoints,
        credits: projection.gpaCredits,
        uncertain,
      }),
    ),
  );
  const results = [];
  let successes = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    let points = fixedPoints;
    for (const course of uncertain) {
      const draw = random() * 100;
      let cumulative = 0;
      let outcomeGrade = course.entries.at(-1)[0];
      for (const [grade, percent] of course.entries) {
        cumulative += percent;
        if (draw < cumulative) {
          outcomeGrade = grade;
          break;
        }
      }
      points += gradePoints[outcomeGrade] * course.credits;
    }
    const gpa = points / projection.gpaCredits;
    results.push(gpa);
    if (gpa + EPSILON >= target) successes += 1;
  }
  results.sort((a, b) => a - b);
  return {
    expectedGpa: projection.gpa,
    p10: percentile(results, 0.1),
    p50: percentile(results, 0.5),
    p90: percentile(results, 0.9),
    chance: successes / samples,
    samples,
    uncertainCount: uncertain.length,
  };
}

/** Scores and weights are percentages. A null score denotes a future assessment. */
export function weightedExams(assessments, target) {
  const invalid = (error) => ({
    weightedScore: null,
    knownWeight: null,
    remainingWeight: null,
    requiredAverage: null,
    currentAverage: null,
    valid: false,
    error,
    possible: false,
    targetReached: false,
  });
  if (!Array.isArray(assessments) || !assessments.length)
    return invalid("Add at least one assessment.");
  if (
    typeof target !== "number" ||
    !Number.isFinite(target) ||
    target < 0 ||
    target > 100
  ) {
    return invalid("Target score must be between 0 and 100.");
  }
  let totalWeight = 0;
  let knownWeight = 0;
  let weightedScore = 0;
  for (const assessment of assessments) {
    if (
      !assessment ||
      typeof assessment.weight !== "number" ||
      !Number.isFinite(assessment.weight) ||
      assessment.weight < 0 ||
      assessment.weight > 100
    ) {
      return invalid("Each assessment weight must be between 0 and 100.");
    }
    if (
      assessment.score !== null &&
      assessment.score !== undefined &&
      (typeof assessment.score !== "number" ||
        !Number.isFinite(assessment.score) ||
        assessment.score < 0 ||
        assessment.score > 100)
    ) {
      return invalid(
        "Each score must be between 0 and 100, or blank for an upcoming assessment.",
      );
    }
    totalWeight += assessment.weight;
    if (assessment.score !== null && assessment.score !== undefined) {
      knownWeight += assessment.weight;
      weightedScore += (assessment.score * assessment.weight) / 100;
    }
  }
  if (Math.abs(totalWeight - 100) > EPSILON)
    return invalid(
      `Assessment weights must total 100% (currently ${totalWeight}%).`,
    );
  const remainingWeight = Math.max(0, 100 - knownWeight);
  return {
    weightedScore,
    knownWeight,
    remainingWeight,
    requiredAverage:
      remainingWeight > EPSILON
        ? ((target - weightedScore) * 100) / remainingWeight
        : null,
    currentAverage:
      knownWeight > EPSILON ? (weightedScore * 100) / knownWeight : null,
    valid: true,
    error: null,
    possible: weightedScore + remainingWeight + EPSILON >= target,
    targetReached: weightedScore + EPSILON >= target,
  };
}
