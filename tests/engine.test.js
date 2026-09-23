import test from "node:test";
import assert from "node:assert/strict";
import {
  gradePoints,
  isPassed,
  stats,
  project,
  targetRequirement,
  retakeImpact,
  probabilityForecast,
  validateDistribution,
  weightedExams,
  semesterForecast,
} from "../engine.js";

const course = (id, credits, extra = {}) => ({
  id,
  code: id.toUpperCase(),
  name: id,
  credits,
  major: true,
  minor: false,
  semester: 1,
  kind: "required",
  ...extra,
});
const close = (actual, expected, tolerance = 1e-10) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not close to ${expected}`,
  );

test("empty transcripts do not display a fictitious zero GPA", () => {
  const result = stats([course("a", 4), course("seminar", 0)], {});
  assert.equal(result.gpa, null);
  assert.equal(result.gpaCredits, 0);
  assert.equal(result.remainingCredits, 4);
  assert.equal(result.remainingCount, 2);
  assert.equal(stats([], {}).gpa, null);
});

test("failed attempts count in GPA, but do not earn credits", () => {
  const result = stats([course("a", 4), course("b", 3), course("c", 2)], {
    a: "BB",
    b: "FD",
    c: "NA",
  });
  close(result.gpa, 13.5 / 9);
  assert.equal(result.gpaCredits, 9);
  assert.equal(result.earnedCredits, 4);
  assert.equal(result.remainingCredits, 5);
  assert.equal(result.passedCount, 1);
  assert.equal(isPassed("DD"), true);
  assert.equal(isPassed("FD"), false);
  assert.equal(isPassed("NA"), false);
  assert.equal(gradePoints.NA, 0);
});

test("S and EX pass without changing GPA; U, I and W remain incomplete", () => {
  const courses = ["a", "b", "c", "d", "e", "f"].map((id) => course(id, 3));
  const result = stats(courses, {
    a: "BA",
    b: "S",
    c: "EX",
    d: "U",
    e: "I",
    f: "W",
  });
  assert.equal(result.gpa, 3.5);
  assert.equal(result.gpaCredits, 3);
  assert.equal(result.earnedCredits, 9);
  assert.equal(result.passedCount, 3);
  assert.equal(result.remainingCount, 3);
  assert.equal(stats([course("a", 3, { gpa: false })], { a: "AA" }).gpa, null);
});

test("a zero-credit required course still needs a pass", () => {
  const courses = [course("internship", 0)];
  assert.equal(stats(courses, {}).remainingCount, 1);
  assert.equal(stats(courses, { internship: "S" }).remainingCount, 0);
  assert.equal(stats(courses, { internship: "S" }).gpa, null);
});

test("major and minor summaries count shared courses once in each program", () => {
  const courses = [
    course("major", 4),
    course("shared", 3, { minor: true }),
    course("minor", 3, { major: false, minor: true }),
  ];
  const transcript = { major: "AA", shared: "BB", minor: "CC" };
  close(stats(courses, transcript).gpa, 25 / 7);
  assert.equal(stats(courses, transcript, "minor").gpa, 2.5);
  assert.equal(stats(courses, transcript, "all").gpa, 3.1);
  assert.equal(stats(courses, transcript, "all").gpaCredits, 10);
});

test("higher and lower repeats replace the previous attempt; they do not add credits", () => {
  const courses = [course("physics", 4), course("math", 5)];
  const transcript = { physics: "BB", math: "AA" };
  const higher = project(courses, transcript, {
    courses: { physics: { grade: "AA" } },
  });
  const lower = project(courses, transcript, {
    courses: { physics: { grade: "FF" } },
  });
  assert.equal(higher.gpa, 4);
  assert.equal(higher.gpaCredits, 9);
  assert.equal(higher.plannedCredits, 4);
  close(lower.gpa, 20 / 9);
  assert.equal(lower.gpaCredits, 9);
  assert.equal(lower.earnedCredits, 5);
  assert.equal(lower.remainingCount, 1);
  assert.deepEqual(transcript, { physics: "BB", math: "AA" });
});

test("a blank scenario does not erase the actual result or plan an unfinished course", () => {
  const courses = [course("a", 4), course("b", 3)];
  const result = project(
    courses,
    { a: "BB" },
    { courses: { a: { grade: "" }, b: { grade: "" } } },
  );
  assert.equal(result.gpa, 3);
  assert.equal(result.plannedCount, 0);
  assert.equal(result.remainingUnplanned, 1);
  assert.equal(result.remainingUnplannedCredits, 3);
});

test("PHYS105 BB to AA has a larger immediate impact than in a fuller final plan", () => {
  const courses = [
    course("phys105", 4),
    course("completed", 16),
    course("future", 80),
  ];
  const transcript = { phys105: "BB", completed: "AA" };
  const scenario = {
    courses: { future: { grade: "BB" }, phys105: { grade: "AA" } },
  };
  const result = retakeImpact(courses, transcript, "phys105", "AA", scenario);
  assert.equal(result.currentGpa, 3.8);
  assert.equal(result.immediateGpa, 4);
  close(result.immediateDelta, 0.2);
  assert.equal(result.projectedBaselineGpa, 3.16);
  assert.equal(result.projectedGpa, 3.2);
  close(result.projectedDelta, 0.04);
  assert.equal(result.pointGain, 4);
  assert.equal(result.projectedCredits, 100);
  const lower = retakeImpact(courses, transcript, "phys105", "CC", scenario);
  assert.ok(lower.immediateDelta < 0);
  assert.ok(lower.projectedDelta < 0);
});

test("required future average uses the actual remaining credits", () => {
  const courses = [course("a", 4), course("b", 6), course("c", 10)];
  const result = targetRequirement(
    courses,
    { a: "BB" },
    { courses: { b: { grade: "AA" } } },
    3.5,
  );
  assert.equal(result.remainingCredits, 10);
  assert.equal(result.fixedPoints, 36);
  assert.equal(result.finalCredits, 20);
  assert.equal(result.requiredAverage, 3.4);
  assert.equal(result.status, "possible");
  assert.equal(result.maxGpa, 3.8);
});

test("the target solver replaces a failed attempt rather than double-counting it", () => {
  const courses = [course("a", 4), course("failed", 4), course("future", 2)];
  const result = targetRequirement(courses, { a: "AA", failed: "FD" }, {}, 3);
  assert.equal(result.fixedPoints, 16);
  assert.equal(result.fixedCredits, 4);
  assert.equal(result.remainingCredits, 6);
  assert.equal(result.finalCredits, 10);
  close(result.requiredAverage, 14 / 6);
});

test("targets report impossible, secured, finished and no-GPA cases honestly", () => {
  const courses = [course("a", 9), course("b", 1)];
  const impossible = targetRequirement(courses, { a: "DD" }, {}, 3);
  assert.equal(impossible.status, "impossible");
  assert.equal(impossible.possible, false);
  assert.ok(impossible.requiredAverage > 4);
  const secured = targetRequirement(courses, { a: "AA" }, {}, 3);
  assert.equal(secured.status, "reached");
  assert.ok(secured.requiredAverage < 0);
  const complete = targetRequirement(courses, { a: "AA", b: "AA" }, {}, 4);
  assert.equal(complete.status, "reached");
  assert.equal(complete.requiredAverage, null);
  const lowerComplete = targetRequirement(courses, { a: "BB", b: "BB" }, {}, 4);
  assert.equal(lowerComplete.status, "impossible");
  assert.equal(
    targetRequirement([course("a", 0)], {}, {}, 3).status,
    "needs-plan",
  );
});

test("nongpa requirements and fixed failed plans are disclosed separately by target solver", () => {
  const courses = [
    course("a", 4),
    course("b", 4),
    course("internship", 0),
    course("pf", 2),
  ];
  const result = targetRequirement(
    courses,
    { a: "AA", pf: "U" },
    { courses: { b: { grade: "FF" } } },
    2,
  );
  assert.equal(result.remainingCredits, 0);
  assert.equal(result.finalCredits, 8);
  assert.equal(result.outstandingFailures, 1);
  assert.equal(result.pendingNonGpaCount, 2);
});

test("target bounds use the support of uncertain outcomes, not their expected grade", () => {
  const courses = [course("a", 4)];
  const scenario = { courses: { a: { distribution: { AA: 50, FF: 50 } } } };
  for (const target of [2, 3]) {
    const result = targetRequirement(courses, {}, scenario, target);
    assert.equal(result.status, "possible");
    assert.equal(result.minGpa, 0);
    assert.equal(result.maxGpa, 4);
    assert.equal(result.expectedMinGpa, 2);
    assert.equal(result.expectedMaxGpa, 2);
    assert.equal(result.hasUncertainty, true);
    assert.equal(result.requiredAverage, null);
  }
});

test("future-average targets distinguish expected, favorable and unfavorable outcomes", () => {
  const courses = [course("a", 4), course("b", 4)];
  const scenario = { courses: { a: { distribution: { AA: 50, CC: 50 } } } };
  const result = targetRequirement(courses, {}, scenario, 3);
  assert.equal(result.requiredAverage, 3);
  assert.equal(result.requiredAverageBestCase, 2);
  assert.equal(result.requiredAverageWorstCase, 4);
  assert.equal(result.minGpa, 1);
  assert.equal(result.maxGpa, 4);
  assert.equal(result.expectedMinGpa, 1.5);
  assert.equal(result.expectedMaxGpa, 3.5);
});

test("subjective distributions have exact expected GPA and expected earned credits", () => {
  const courses = [course("a", 4), course("b", 4)];
  const result = project(
    courses,
    { a: "BB" },
    {
      courses: { b: { grade: "AA", distribution: { AA: 25, BB: 50, FF: 25 } } },
    },
  );
  assert.equal(result.gpa, 2.75);
  assert.equal(result.earnedCredits, 7);
  assert.equal(result.passedCount, 1.75);
  assert.equal(result.remainingUnplanned, 0);
  assert.equal(result.remainingCredits, 1);
});

test("invalid probabilities are rejected, never normalized or silently coerced", () => {
  for (const distribution of [
    { AA: 99 },
    { AA: 60, BB: 60 },
    { AA: -1, BB: 101 },
    { AA: "100" },
    { AA: NaN },
    { S: 100 },
    {},
    [],
  ])
    assert.throws(() => validateDistribution(distribution));
  assert.equal(
    validateDistribution({ AA: 33.3, BB: 33.3, CC: 33.4 }).total,
    100,
  );
  assert.throws(() =>
    project(
      [course("a", 3)],
      {},
      { courses: { a: { distribution: { AA: 90 } } } },
    ),
  );
});

test("forecasts are deterministic with exact means and empirical threshold probability", () => {
  const courses = [course("a", 4), course("b", 4)];
  const transcript = { a: "BB" };
  const scenario = { courses: { b: { distribution: { AA: 50, FF: 50 } } } };
  const first = probabilityForecast(
    courses,
    transcript,
    scenario,
    3,
    "major",
    12000,
  );
  assert.deepEqual(
    first,
    probabilityForecast(courses, transcript, scenario, 3, "major", 12000),
  );
  assert.equal(first.expectedGpa, 2.5);
  assert.equal(first.p10, 1.5);
  assert.equal(first.p90, 3.5);
  assert.ok(first.chance > 0.48 && first.chance < 0.52);
  assert.equal(first.uncertainCount, 1);
  assert.equal(first.samples, 12000);
});

test("forecasts handle deterministic, empty and probability-based repeat plans", () => {
  const courses = [course("a", 4)];
  assert.equal(probabilityForecast(courses, { a: "BB" }, {}, 3).chance, 1);
  assert.equal(probabilityForecast(courses, { a: "BB" }, {}, 3.1).chance, 0);
  assert.equal(probabilityForecast(courses, {}, {}, 3).chance, null);
  const repeat = probabilityForecast(
    courses,
    { a: "BB" },
    { courses: { a: { distribution: { AA: 50, CC: 50 } } } },
    3,
  );
  assert.equal(repeat.expectedGpa, 3);
  assert.equal(repeat.p10, 2);
  assert.equal(repeat.p90, 4);
  assert.throws(() => probabilityForecast(courses, {}, {}, 3, "major", 0));
});

test("weighted exam scores report earned contribution and required remaining score", () => {
  const result = weightedExams(
    [
      { name: "Midterm", weight: 40, score: 70 },
      { name: "Homework", weight: 10, score: 90 },
      { name: "Final", weight: 50, score: null },
    ],
    80,
  );
  assert.equal(result.valid, true);
  assert.equal(result.weightedScore, 37);
  assert.equal(result.knownWeight, 50);
  assert.equal(result.remainingWeight, 50);
  assert.equal(result.currentAverage, 74);
  assert.equal(result.requiredAverage, 86);
  assert.equal(result.possible, true);
});

test("exam targets handle impossible, secured, no results, and fully graded cases", () => {
  const impossible = weightedExams(
    [
      { weight: 90, score: 20 },
      { weight: 10, score: null },
    ],
    80,
  );
  assert.equal(impossible.possible, false);
  assert.equal(impossible.requiredAverage, 620);
  const secured = weightedExams(
    [
      { weight: 90, score: 100 },
      { weight: 10, score: null },
    ],
    80,
  );
  assert.equal(secured.targetReached, true);
  assert.equal(secured.requiredAverage, -100);
  const empty = weightedExams([{ weight: 100, score: null }], 80);
  assert.equal(empty.requiredAverage, 80);
  assert.equal(empty.currentAverage, null);
  const done = weightedExams([{ weight: 100, score: 75 }], 80);
  assert.equal(done.requiredAverage, null);
  assert.equal(done.possible, false);
  assert.equal(done.targetReached, false);
});

test("invalid exam weights and scores return explicit validation failures", () => {
  for (const assessments of [
    [],
    [{ weight: 90, score: 80 }],
    [{ weight: 100, score: 101 }],
    [{ weight: 100, score: -1 }],
    [{ weight: 100, score: "80" }],
    [
      { weight: -20, score: 80 },
      { weight: 120, score: null },
    ],
    [{ weight: NaN, score: 80 }],
    [{ weight: 100, score: NaN }],
  ]) {
    const result = weightedExams(assessments, 80);
    assert.equal(result.valid, false);
    assert.ok(result.error);
    assert.equal(result.requiredAverage, null);
  }
  assert.equal(weightedExams([{ weight: 100, score: 0 }], 101).valid, false);
});

test("bad catalog data, grades and targets cannot quietly corrupt totals", () => {
  assert.throws(() => stats([course("a", -3)], {}));
  assert.throws(() => stats([course("a", 3), course("a", 4)], {}));
  assert.throws(() => stats([course("a", 3)], { a: "N/A" }));
  assert.throws(() => stats([course("a", 3)], {}, "unknown"));
  assert.throws(() => targetRequirement([course("a", 3)], {}, {}, 4.1));
  assert.throws(() => retakeImpact([course("a", 3)], {}, "missing", "AA"));
});

test("the default chronological forecast includes all ten semesters", () => {
  const rows = semesterForecast(
    [course("a", 4, { semester: 1 })],
    { a: "BB" },
    {},
  );
  assert.equal(rows.length, 10);
  assert.deepEqual(
    rows.map((row) => row.term),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.equal(rows[0].major.semesterGpa, 3);
  assert.equal(rows[1].major.semesterGpa, null);
  assert.equal(rows[9].major.cumulativeGpa, 3);
  assert.equal(rows[9].major.cumulativeCredits, 4);
});

test("moving ME301 from semester5 to semester7 changes early projections only", () => {
  const courses = [
    course("past", 4, { semester: 1 }),
    course("me301", 3, { semester: 5 }),
  ];
  const transcript = { past: "BB" };
  const early = semesterForecast(courses, transcript, {
    courses: { me301: { grade: "AA", term: 5 } },
  });
  const late = semesterForecast(courses, transcript, {
    courses: { me301: { grade: "AA", term: 7 } },
  });
  assert.equal(early[4].major.semesterGpa, 4);
  assert.equal(late[4].major.semesterGpa, null);
  assert.equal(late[4].major.cumulativeGpa, 3);
  close(early[4].major.cumulativeGpa, 24 / 7);
  assert.equal(late[6].major.semesterGpa, 4);
  assert.equal(early[9].major.cumulativeGpa, late[9].major.cumulativeGpa);
  assert.equal(
    early[9].major.cumulativeCredits,
    late[9].major.cumulativeCredits,
  );
});

test("actual catalog semester overrides also alter chronology without altering final GPA", () => {
  const original = [
    course("past", 4, { semester: 1 }),
    course("me301", 3, { semester: 5 }),
  ];
  const moved = original.map((item) =>
    item.id === "me301" ? { ...item, semester: 7 } : item,
  );
  const transcript = { past: "BB", me301: "AA" };
  const early = semesterForecast(original, transcript);
  const late = semesterForecast(moved, transcript);
  assert.equal(late[4].major.cumulativeGpa, 3);
  assert.equal(early[4].major.semesterGpa, 4);
  assert.equal(late[6].major.semesterGpa, 4);
  assert.equal(early[9].major.cumulativeGpa, late[9].major.cumulativeGpa);
});

test("a repeat affects cumulative GPA only when its planned semester is reached", () => {
  const courses = [
    course("physics", 4, { semester: 1 }),
    course("math", 4, { semester: 2 }),
  ];
  const transcript = { physics: "BB", math: "AA" };
  const rows = semesterForecast(courses, transcript, {
    courses: { physics: { grade: "AA", term: 7 } },
  });
  assert.equal(rows[0].major.cumulativeGpa, 3);
  assert.equal(rows[1].major.cumulativeGpa, 3.5);
  assert.equal(rows[5].major.cumulativeGpa, 3.5);
  assert.equal(rows[6].major.semesterGpa, 4);
  assert.equal(rows[6].major.cumulativeGpa, 4);
  assert.equal(rows[6].major.semesterCredits, 4);
  assert.equal(rows[6].major.cumulativeCredits, 8);
  assert.equal(rows[6].major.earnedCredits, 8);
  assert.deepEqual(rows[0].courses[0], {
    id: "physics",
    grade: "BB",
    planned: false,
    repeat: false,
  });
  assert.equal(rows[6].courses[0].repeat, true);
});

test("lower repeat grades replace previous passes at the right semester", () => {
  const courses = [course("a", 4, { semester: 1 })];
  const rows = semesterForecast(
    courses,
    { a: "AA" },
    { courses: { a: { grade: "FF", term: 5 } } },
  );
  assert.equal(rows[3].major.cumulativeGpa, 4);
  assert.equal(rows[3].major.earnedCredits, 4);
  assert.equal(rows[4].major.cumulativeGpa, 0);
  assert.equal(rows[4].major.earnedCredits, 0);
  assert.equal(rows[4].major.cumulativeCredits, 4);
});

test("same-semester repeats count only the final planned attempt", () => {
  const rows = semesterForecast(
    [course("a", 4, { semester: 1 })],
    { a: "BB" },
    {
      courses: { a: { grade: "AA", term: 1 } },
    },
  );
  assert.equal(rows[0].courses.length, 1);
  assert.equal(rows[0].major.semesterGpa, 4);
  assert.equal(rows[0].major.semesterCredits, 4);
  assert.equal(rows[0].major.cumulativeCredits, 4);
});

test("unplanned and future actual courses do not leak into earlier GPAs", () => {
  const courses = [
    course("actual", 4, { semester: 3 }),
    course("later", 3, { semester: 8 }),
    course("unplanned", 5, { semester: 7 }),
    course("unscheduled", 3, { semester: null }),
  ];
  const rows = semesterForecast(
    courses,
    { actual: "BB", later: "AA" },
    {},
    {
      currentSemester: 3,
      graduationSemester: 10,
    },
  );
  assert.equal(rows[1].major.cumulativeGpa, null);
  assert.equal(rows[2].major.cumulativeGpa, 3);
  assert.equal(rows[2].major.cumulativeCredits, 4);
  assert.ok(
    rows[2].courses.some(
      (item) => item.id === "unscheduled" && item.grade === "",
    ),
  );
  assert.equal(rows[6].major.semesterGpa, null);
  assert.equal(rows[6].major.cumulativeGpa, 3);
  assert.equal(rows[6].courses[0].id, "unplanned");
  close(rows[7].major.cumulativeGpa, 24 / 7);
  assert.equal(rows[9].major.cumulativeCredits, 7);
});

test("probability timelines use exact expected results and separate minor summaries", () => {
  const courses = [
    course("shared", 4, { semester: 1, minor: true }),
    course("minor", 3, { semester: null, major: false, minor: true }),
  ];
  const rows = semesterForecast(
    courses,
    { shared: "BB" },
    {
      courses: {
        shared: { term: 7, distribution: { AA: 50, FF: 50 } },
        minor: { term: 7, grade: "AA" },
      },
    },
  );
  assert.equal(rows[6].major.semesterGpa, 2);
  assert.equal(rows[6].major.cumulativeGpa, 2);
  assert.equal(rows[6].major.earnedCredits, 2);
  close(rows[6].minor.semesterGpa, 20 / 7);
  close(rows[6].minor.cumulativeGpa, 20 / 7);
  assert.equal(rows[6].minor.earnedCredits, 5);
  assert.equal(rows[6].courses[0].expectedGradePoints, 2);
});

test("timelines preserve explicitly later terms and reject invalid placements", () => {
  const courses = [course("a", 4, { semester: 1 })];
  const rows = semesterForecast(
    courses,
    {},
    { courses: { a: { grade: "AA", term: 12 } } },
  );
  assert.equal(rows.length, 12);
  assert.equal(rows[11].major.cumulativeGpa, 4);
  assert.throws(() =>
    semesterForecast(
      courses,
      {},
      { courses: { a: { grade: "AA", term: 13 } } },
    ),
  );
  assert.throws(() =>
    semesterForecast(courses, {}, {}, { currentSemester: 0 }),
  );
});
