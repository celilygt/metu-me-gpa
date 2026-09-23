import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  createState,
  validateState,
  parseImport,
  exportJSON,
  migrateLegacy,
  loadState,
  saveState,
  chatGPTPrompt,
} from "../state.js";

const catalog = [
  {
    id: "PHYS105",
    code: "PHYS 105",
    name: "General Physics I",
    credits: 4,
    semester: 1,
    major: true,
    minor: false,
    kind: "required",
  },
  {
    id: "ME117",
    code: "ME 117",
    name: "Drawing",
    credits: 3,
    semester: 1,
    major: true,
    minor: false,
    kind: "required",
  },
  {
    id: "FREE",
    code: "FREE",
    name: "Free elective",
    credits: 3,
    semester: 7,
    major: true,
    minor: false,
    kind: "free",
  },
  {
    id: "TE1",
    code: "TE 1",
    name: "Technical elective",
    credits: 3,
    semester: 7,
    major: true,
    minor: false,
    kind: "technical",
  },
  {
    id: "ME462",
    code: "ME 462",
    name: "Mechatronic design",
    credits: 3,
    semester: null,
    major: false,
    minor: true,
    kind: "minor-required",
  },
];

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    writes: [],
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      this.writes.push(key);
      values.set(key, String(value));
    },
  };
}

function filledState() {
  const state = createState();
  state.profile.group = "B";
  state.transcript = { PHYS105: "BB", ME117: "NA" };
  state.courseOverrides = {
    FREE: { code: "ME 400", name: "Seçtiğim ders", credits: 4, minor: true },
  };
  state.customCourses = [
    {
      id: "custom-1",
      code: "EE 999",
      name: "Özel ders",
      credits: 3,
      semester: 6,
      major: false,
      minor: true,
      kind: "custom",
    },
  ];
  state.scenarios[0].courses = {
    PHYS105: {
      grade: "AA",
      term: 5,
      distribution: { AA: 40, BA: 40, BB: 20 },
      assessments: [
        { name: "Vize", weight: 40, score: 75 },
        { name: "Final", weight: 60, score: null },
      ],
      examTarget: 85,
    },
    "custom-1": { grade: "BA", term: 2 },
    ME462: {
      grade: "",
      term: 3,
      assessments: [{ name: "Final", weight: 60, score: null }],
    },
  };
  return state;
}

test("full JSON round trip preserves transcript, overrides, minor, custom courses, probabilities and exam inputs", () => {
  const state = filledState();
  assert.deepEqual(parseImport(exportJSON(state), catalog), state);
  assert.deepEqual(
    parseImport(`\n\`\`\`json\n${exportJSON(state)}\n\`\`\`\n`, catalog),
    state,
  );
  assert.deepEqual(parseImport(`\uFEFF${exportJSON(state)}`, catalog), state);
  const normalized = validateState(state, catalog);
  normalized.scenarios[0].courses.PHYS105.assessments[0].score = 0;
  assert.equal(state.scenarios[0].courses.PHYS105.assessments[0].score, 75);
});

test("blank predicted grade and incomplete exam weights are valid editable plans", () => {
  const state = filledState();
  const result = validateState(state, catalog);
  assert.equal(result.scenarios[0].courses.ME462.grade, "");
  assert.equal(result.scenarios[0].courses.ME462.assessments[0].weight, 60);
  for (const value of ["S", "U", "EX", "NA", "I", "W"]) {
    state.transcript.PHYS105 = value;
    assert.equal(validateState(state, catalog).transcript.PHYS105, value);
  }
  state.transcript.PHYS105 = "";
  assert.throws(() => validateState(state, catalog), /harf notu/);
});

test("malformed imports fail without changing the current state", () => {
  const state = filledState();
  const before = exportJSON(state);
  for (const text of [
    "{",
    "null",
    "[]",
    "Here is your JSON:\n{}",
    "```json\n{}\n``` extra",
  ]) {
    assert.throws(() => parseImport(text, catalog));
  }
  assert.equal(exportJSON(state), before);
  assert.throws(
    () => parseImport(" ".repeat(2 * 1024 * 1024 + 1), catalog),
    /2 MB/,
  );
  assert.throws(
    () => parseImport("ş".repeat(1024 * 1024 + 1), catalog),
    /2 MB/,
  );
});

test("schema rejects unknown fields, missing required fields and unsupported versions", () => {
  const mutations = [
    (s) => {
      s.schemaVersion = 1;
    },
    (s) => {
      s.catalog = catalog;
    },
    (s) => {
      delete s.transcript;
    },
    (s) => {
      s.profile.group = "C";
    },
    (s) => {
      s.profile.minorEnabled = "true";
    },
    (s) => {
      s.profile.target = 4.01;
    },
    (s) => {
      s.profile.target = NaN;
    },
    (s) => {
      s.profile.target = "3.5";
    },
    (s) => {
      s.profile.currentSemester = 0;
    },
    (s) => {
      s.profile.currentSemester = null;
    },
    (s) => {
      s.profile.graduationSemester = 13;
    },
    (s) => {
      s.profile.graduationSemester = 4;
    },
    (s) => {
      s.profile.currentSemester = 5.5;
    },
    (s) => {
      s.example = "yes";
    },
    (s) => {
      s.scenarios[0].courses.PHYS105.extra = true;
    },
  ];
  for (const mutate of mutations) {
    const state = filledState();
    mutate(state);
    assert.throws(() => validateState(state, catalog));
  }
});

test("unknown course IDs and duplicate course/scenario IDs are rejected", () => {
  for (const field of ["transcript", "courseOverrides"]) {
    const state = filledState();
    state[field].MISSING = field === "transcript" ? "AA" : { credits: 3 };
    assert.throws(() => validateState(state, catalog), /katalogda bulunamadı/);
  }
  const state = filledState();
  state.scenarios[0].courses.MISSING = { grade: "AA", term: 1 };
  assert.throws(() => validateState(state, catalog), /katalogda bulunamadı/);
  delete state.scenarios[0].courses.MISSING;
  state.customCourses[0].id = "PHYS105";
  assert.throws(() => validateState(state, catalog), /Yinelenen ders/);
  state.customCourses[0].id = "custom-1";
  state.scenarios.push(structuredClone(state.scenarios[0]));
  assert.throws(() => validateState(state, catalog), /Yinelenen senaryo/);
  state.scenarios.pop();
  state.activeScenarioId = "missing";
  assert.throws(() => validateState(state, catalog), /Aktif senaryo/);
});

test("scenario and custom-course limits reject unbounded inputs", () => {
  const state = createState();
  state.scenarios = Array.from({ length: 21 }, (_, index) => ({
    id: `plan-${index}`,
    name: `Plan ${index}`,
    courses: {},
  }));
  assert.throws(() => validateState(state, catalog), /1–20/);
  state.scenarios = createState().scenarios;
  state.customCourses = Array.from({ length: 101 }, (_, index) => ({
    id: `c-${index}`,
  }));
  assert.throws(() => validateState(state, catalog), /0–100/);
  state.customCourses = [];
  state.scenarios = [];
  assert.throws(() => validateState(state, catalog), /1–20/);
});

test("resolved duplicate real course codes cannot double-count through overrides or custom courses", () => {
  const state = filledState();
  state.customCourses[0].code = "phys 105";
  assert.throws(
    () => parseImport(exportJSON(state), catalog),
    /Aynı ders kodu.*PHYS105.*custom-1/,
  );
  state.customCourses[0].code = "EE 999";
  state.courseOverrides.FREE.code = "P H Y S 1 0 5";
  assert.throws(
    () => validateState(state, catalog),
    /Aynı ders kodu.*PHYS105.*FREE/,
  );
  state.courseOverrides.FREE.code = "ME 400";
  state.courseOverrides["custom-1"] = { code: "me400" };
  assert.throws(
    () => validateState(state, catalog),
    /Aynı ders kodu.*FREE.*custom-1/,
  );
});

test("JSON imports reject selected predictions at or before the actual course semester", () => {
  const state = filledState();
  state.courseOverrides.PHYS105 = { semester: 4 };
  for (const actualGrade of ["AA", "NA", "S", "U", "EX", "I", "W"]) {
    state.transcript.PHYS105 = actualGrade;
    for (const term of [3, 4]) {
      state.scenarios[0].courses.PHYS105.term = term;
      assert.throws(
        () => parseImport(exportJSON(state), catalog),
        /tekrar planı.*4\. döneminden sonra/,
      );
    }
  }
  state.scenarios[0].courses.PHYS105.term = 5;
  assert.doesNotThrow(() => validateState(state, catalog));
  state.scenarios[0].courses.PHYS105.term = 4;
  state.scenarios[0].courses.PHYS105.grade = "";
  assert.throws(() => validateState(state, catalog), /tekrar planı/);
  delete state.scenarios[0].courses.PHYS105.distribution;
  assert.doesNotThrow(() => validateState(state, catalog));
});

test("actual semester respects group B, explicit overrides, and null catalog semesters", () => {
  const expandedCatalog = [
    ...catalog,
    {
      id: "ME110",
      code: "ME 110",
      name: "Introduction",
      credits: 2,
      semester: 2,
      major: true,
      minor: false,
    },
    {
      id: "METE230",
      code: "METE 230",
      name: "Materials",
      credits: 3,
      semester: 3,
      major: true,
      minor: false,
    },
  ];
  const state = createState();
  state.profile.group = "B";
  for (const [courseId, actualTerm] of [
    ["ME110", 1],
    ["ME117", 2],
    ["METE230", 4],
    ["ME462", 5],
  ]) {
    state.transcript = { [courseId]: "BB" };
    state.scenarios[0].courses = {
      [courseId]: { grade: "AA", term: actualTerm },
    };
    assert.throws(() => validateState(state, expandedCatalog), /tekrar planı/);
    state.scenarios[0].courses[courseId].term = actualTerm + 1;
    assert.doesNotThrow(() => validateState(state, expandedCatalog));
  }
  state.transcript = { ME117: "BB" };
  state.courseOverrides.ME117 = { semester: 1 };
  state.scenarios[0].courses = { ME117: { grade: "AA", term: 2 } };
  assert.doesNotThrow(() => validateState(state, expandedCatalog));
  state.courseOverrides.ME117.semester = 3;
  assert.throws(
    () => validateState(state, expandedCatalog),
    /3\. döneminden sonra/,
  );
});

test("probability distributions are rejected for resolved zero-credit courses", () => {
  const state = filledState();
  state.courseOverrides.PHYS105 = { credits: 0 };
  assert.throws(() => validateState(state, catalog), /sıfır kredili ders/);
  delete state.scenarios[0].courses.PHYS105.distribution;
  assert.doesNotThrow(() => validateState(state, catalog));
  state.customCourses[0].credits = 0;
  state.scenarios[0].courses["custom-1"].distribution = { AA: 100 };
  assert.throws(() => validateState(state, catalog), /sıfır kredili ders/);
});

test("credits, term, score and probability validation reject invalid arithmetic", () => {
  const mutations = [
    (s) => {
      s.courseOverrides.FREE.credits = -1;
    },
    (s) => {
      s.courseOverrides.FREE.credits = Infinity;
    },
    (s) => {
      s.courseOverrides.FREE.credits = 31;
    },
    (s) => {
      s.scenarios[0].courses.PHYS105.term = 1.5;
    },
    (s) => {
      s.scenarios[0].courses.PHYS105.term = 0;
    },
    (s) => {
      s.scenarios[0].courses.PHYS105.term = 13;
    },
    (s) => {
      s.courseOverrides.FREE.semester = 13;
    },
    (s) => {
      s.scenarios[0].courses.PHYS105.distribution = { AA: 90 };
    },
    (s) => {
      s.scenarios[0].courses.PHYS105.distribution = { AA: 101, FF: -1 };
    },
    (s) => {
      s.scenarios[0].courses.PHYS105.distribution = { S: 100 };
    },
    (s) => {
      s.scenarios[0].courses.PHYS105.distribution = { AA: "100" };
    },
    (s) => {
      s.scenarios[0].courses.PHYS105.assessments[0].score = 101;
    },
    (s) => {
      s.scenarios[0].courses.PHYS105.assessments[0].weight = -1;
    },
    (s) => {
      s.scenarios[0].courses.PHYS105.examTarget = null;
    },
  ];
  for (const mutate of mutations) {
    const state = filledState();
    mutate(state);
    assert.throws(() => validateState(state, catalog));
  }
  const state = filledState();
  state.courseOverrides.FREE.credits = 0;
  state.scenarios[0].courses.PHYS105.distribution = {
    AA: 33.333333333333,
    BA: 33.333333333333,
    BB: 33.333333333334,
  };
  assert.doesNotThrow(() => validateState(state, catalog));
});

test("five-year plans preserve absolute terms and per-course semester overrides", () => {
  const state = filledState();
  state.profile.currentSemester = 5;
  state.profile.graduationSemester = 10;
  state.scenarios[0].courses.PHYS105.term = 10;
  state.courseOverrides.FREE.semester = 9;
  state.customCourses[0].semester = 12;
  assert.deepEqual(parseImport(exportJSON(state), catalog), state);
  state.profile.currentSemester = 12;
  state.profile.graduationSemester = 12;
  assert.equal(validateState(state, catalog).profile.currentSemester, 12);
});

test("earlier version-two imports receive semester defaults without changing other profile fields", () => {
  const state = filledState();
  delete state.profile.currentSemester;
  delete state.profile.graduationSemester;
  const result = validateState(state, catalog);
  assert.equal(result.profile.currentSemester, 5);
  assert.equal(result.profile.graduationSemester, 10);
  assert.equal(result.profile.group, "B");
  assert.equal(result.profile.target, state.profile.target);
});

test("prototype pollution, unsafe IDs, exotic objects and excessive nesting are rejected", () => {
  for (const key of ["__proto__", "constructor", "prototype"]) {
    const state = createState();
    const input = JSON.parse(exportJSON(state));
    Object.defineProperty(input.transcript, key, {
      value: { polluted: true },
      enumerable: true,
    });
    assert.throws(() => validateState(input, catalog), /güvenli olmayan/);
    state.scenarios[0].id = key;
    assert.throws(() => validateState(state, catalog), /geçersiz kimlik/);
  }
  const state = createState();
  state.profile = new Date();
  assert.throws(() => validateState(state, catalog));
  state.profile = createState().profile;
  state.profile.recursive = state;
  assert.throws(() => validateState(state, catalog), /döngüsel/);
  assert.equal({}.polluted, undefined);
});

test("legacy semester keys map to stable IDs, preserving group and unique elective slots", () => {
  const result = migrateLegacy(
    {
      "2-ME 117": "BA",
      "1-PHYS 105": "BB",
      "7-FREE": "CC",
      "7-TE 1": "AA",
      "2-CHEM 107": "N/A",
    },
    "B",
    catalog,
  );
  assert.deepEqual(result.transcript, {
    ME117: "BA",
    PHYS105: "BB",
    FREE: "CC",
    TE1: "AA",
  });
  assert.equal(result.profile.group, "B");
  assert.equal(result.example, false);
  assert.deepEqual(
    migrateLegacy({ "1-ME 117": "AA", "2-ME 117": "AA" }, "A", catalog)
      .transcript,
    { ME117: "AA" },
  );
});

test("conflicting legacy semester grades fail clearly without arbitrarily selecting a grade", () => {
  assert.throws(
    () => migrateLegacy({ "1-ME 117": "BB", "2-ME 117": "AA" }, "A", catalog),
    /çelişen notlar.*BB.*AA/,
  );
  assert.throws(
    () => migrateLegacy({ "7-NOT REAL": "AA" }, "A", catalog),
    /tanınmadı/,
  );
  assert.throws(
    () => migrateLegacy({ "1-ME 117": "A+" }, "A", catalog),
    /harf notu/,
  );
});

test("load is read-only, migrates legacy records, and modern storage takes precedence", () => {
  const rawLegacy = JSON.stringify({ "1-PHYS 105": "BB" });
  const store = storage({ metuMeGrades: rawLegacy, metuMeSurnameGroup: "B" });
  const loaded = loadState(store, catalog);
  assert.match(loaded.notice, /aktarıldı/);
  assert.equal(loaded.state.transcript.PHYS105, "BB");
  assert.equal(loaded.state.profile.group, "B");
  assert.equal(store.writes.length, 0);
  assert.deepEqual(saveState(store, filledState()), { ok: true });
  assert.equal(store.getItem("metuMeGrades"), rawLegacy);
  assert.deepEqual(loadState(store, catalog).state, filledState());
});

test("corrupt modern storage is preserved during load and copied before a subsequent save", () => {
  const raw = "{broken but potentially recoverable";
  const store = storage({ [STORAGE_KEY]: raw });
  const loaded = loadState(store, catalog);
  assert.ok(loaded.error);
  assert.deepEqual(loaded.state, createState());
  assert.equal(store.getItem(STORAGE_KEY), raw);
  assert.equal(store.writes.length, 0);
  const saved = saveState(store, filledState());
  assert.equal(saved.ok, true);
  assert.equal(store.getItem(saved.recoveryKey), raw);
  assert.deepEqual(
    parseImport(store.getItem(STORAGE_KEY), catalog),
    filledState(),
  );
  assert.equal(store.writes[0], saved.recoveryKey);
});

test("failed recovery backup never replaces the corrupt original", () => {
  const store = storage({ [STORAGE_KEY]: "broken" });
  loadState(store, catalog);
  store.setItem = () => {
    throw new Error("quota");
  };
  assert.equal(saveState(store, createState()).ok, false);
  assert.equal(store.getItem(STORAGE_KEY), "broken");
});

test("unavailable storage and malformed legacy data leave the app usable with an explicit notice", () => {
  const unavailable = {
    getItem() {
      throw new Error("disabled");
    },
    setItem() {
      throw new Error("disabled");
    },
  };
  assert.deepEqual(loadState(unavailable, catalog).state, createState());
  assert.ok(loadState(unavailable, catalog).error);
  assert.equal(saveState(unavailable, createState()).ok, false);
  const legacy = storage({ metuMeGrades: "{" });
  assert.ok(loadState(legacy, catalog).error);
  assert.equal(legacy.getItem("metuMeGrades"), "{");
});

test("ChatGPT prompt contains resolved catalog, full importable state and the planning boundaries", () => {
  const state = filledState();
  const prompt = chatGPTPrompt(state, catalog);
  assert.deepEqual(
    parseImport(prompt.split("Mevcut uygulama JSON'u:\n")[1], catalog),
    state,
  );
  assert.match(prompt, /yalnızca başvuru/);
  assert.match(prompt, /"code": "ME 400"/);
  assert.match(
    prompt,
    /transcript, profile, courseOverrides ve customCourses alanlarını değiştirme/,
  );
  assert.match(prompt, /son not esas alınır/);
  assert.match(prompt, /gerçek başarı tahmini değildir/);
  assert.match(prompt, /Sınav ortalamasını otomatik bir harf notuna çevirme/);
  assert.match(prompt, /term mutlak akademik dönemdir/);
  assert.match(prompt, /transcript alanını asla değiştirme/);
});
