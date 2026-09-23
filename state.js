export const STORAGE_KEY = "metuMePlanner.v2";

const LEGACY_GRADES_KEY = "metuMeGrades";
const LEGACY_GROUP_KEY = "metuMeSurnameGroup";
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_COURSES = 500;
const POINT_GRADES = [
  "AA",
  "BA",
  "BB",
  "CB",
  "CC",
  "DC",
  "DD",
  "FD",
  "FF",
  "NA",
];
const GRADES = [...POINT_GRADES, "S", "U", "EX", "I", "W"];
const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const pendingRecovery = new WeakMap();

export function createState() {
  return {
    schemaVersion: 2,
    profile: {
      group: "A",
      minorEnabled: true,
      target: 3.5,
      currentSemester: 5,
      graduationSemester: 10,
    },
    transcript: {},
    courseOverrides: {},
    customCourses: [],
    scenarios: [{ id: "plan-1", name: "İlk planım", courses: {} }],
    activeScenarioId: "plan-1",
    example: false,
  };
}

function fail(message) {
  throw new Error(message);
}

function record(value, label) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    fail(`${label}: bir JSON nesnesi gerekli.`);
  }
  return value;
}

function fields(value, allowed, required, label) {
  record(value, label);
  for (const key of Object.keys(value)) {
    if (UNSAFE_KEYS.has(key) || !allowed.includes(key))
      fail(`${label}: desteklenmeyen alan “${key}”.`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail(`${label}: “${key}” alanı eksik.`);
  }
}

function number(value, min, max, label, integer = false) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    fail(
      `${label}: ${min}–${max} arasında ${integer ? "tam " : ""}sayı gerekli.`,
    );
  return value;
}

function string(value, max, label) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    fail(`${label}: 1–${max} karakterlik metin gerekli.`);
  }
  return value.trim();
}

function id(value, label) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value) ||
    UNSAFE_KEYS.has(value)
  ) {
    fail(`${label}: geçersiz kimlik.`);
  }
  return value;
}

function boolean(value, label) {
  if (typeof value !== "boolean") fail(`${label}: true veya false gerekli.`);
  return value;
}

function grade(value, label, allowBlank = false) {
  if (!(allowBlank && value === "") && !GRADES.includes(value))
    fail(`${label}: geçersiz harf notu “${String(value)}”.`);
  return value;
}

function list(value, min, max, label) {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    fail(`${label}: ${min}–${max} öğelik liste gerekli.`);
  return value;
}

function checkTree(
  value,
  depth = 0,
  budget = { remaining: 100000 },
  seen = new Set(),
) {
  if (--budget.remaining < 0 || depth > 12)
    fail("JSON çok büyük veya fazla iç içe.");
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) fail("JSON döngüsel başvurular içeremez.");
  seen.add(value);
  if (!Array.isArray(value)) record(value, "JSON");
  for (const key of Object.keys(value)) {
    if (UNSAFE_KEYS.has(key))
      fail(`JSON güvenli olmayan bir alan içeriyor: ${key}.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!Object.hasOwn(descriptor, "value"))
      fail("JSON yalnızca veri alanları içerebilir.");
    checkTree(descriptor.value, depth + 1, budget, seen);
  }
  seen.delete(value);
}

function catalogCourses(catalog) {
  const courses = Array.isArray(catalog)
    ? catalog
    : Object.values(record(catalog, "Ders kataloğu"));
  if (courses.length > MAX_COURSES) fail("Ders kataloğu çok büyük.");
  const ids = new Set();
  for (const course of courses) {
    record(course, "Katalog dersi");
    id(course.id, "Katalog ders kimliği");
    if (ids.has(course.id))
      fail(`Katalogda yinelenen ders kimliği: ${course.id}.`);
    ids.add(course.id);
  }
  return courses;
}

function courseFields(value, label) {
  const result = {};
  if (Object.hasOwn(value, "code"))
    result.code = string(value.code, 40, `${label} kodu`);
  if (Object.hasOwn(value, "name"))
    result.name = string(value.name, 160, `${label} adı`);
  if (Object.hasOwn(value, "credits"))
    result.credits = number(value.credits, 0, 30, `${label} kredisi`);
  if (Object.hasOwn(value, "major"))
    result.major = boolean(value.major, `${label} anadal`);
  if (Object.hasOwn(value, "minor"))
    result.minor = boolean(value.minor, `${label} yandal`);
  if (Object.hasOwn(value, "semester"))
    result.semester = number(value.semester, 1, 12, `${label} dönemi`, true);
  return result;
}

function distribution(value, label) {
  fields(value, POINT_GRADES, [], label);
  const result = {};
  let total = 0;
  for (const [key, amount] of Object.entries(value)) {
    result[key] = number(amount, 0, 100, `${label} ${key}`);
    total += amount;
  }
  if (Math.abs(total - 100) > 1e-9)
    fail(
      `${label}: olasılıkların toplamı %100 olmalı (şu an %${Number(total.toFixed(4))}).`,
    );
  return result;
}

function resolveCourses(state, courses) {
  const groupSemesters =
    state.profile.group === "B" ? { ME110: 1, ME117: 2, METE230: 4 } : {};
  return [...courses, ...state.customCourses].map((course) => {
    const override = state.courseOverrides[course.id] || {};
    return {
      ...course,
      ...override,
      semester:
        override.semester ??
        groupSemesters[course.id] ??
        course.semester ??
        state.profile.currentSemester,
    };
  });
}

export function validateState(input, catalog) {
  checkTree(input);
  const keys = [
    "schemaVersion",
    "profile",
    "transcript",
    "courseOverrides",
    "customCourses",
    "scenarios",
    "activeScenarioId",
    "example",
  ];
  fields(
    input,
    keys,
    keys.filter((key) => key !== "example"),
    "Plan",
  );
  if (input.schemaVersion !== 2)
    fail("Bu JSON sürümü desteklenmiyor. schemaVersion 2 olmalı.");
  fields(
    input.profile,
    [
      "group",
      "minorEnabled",
      "target",
      "currentSemester",
      "graduationSemester",
    ],
    ["group", "minorEnabled", "target"],
    "Profil",
  );
  if (!["A", "B"].includes(input.profile.group))
    fail("Soyadı grubu A veya B olmalı.");
  const state = createState();
  state.profile = {
    group: input.profile.group,
    minorEnabled: boolean(input.profile.minorEnabled, "Yandal seçimi"),
    target: number(input.profile.target, 0, 4, "GNO hedefi"),
    currentSemester: number(
      Object.hasOwn(input.profile, "currentSemester")
        ? input.profile.currentSemester
        : 5,
      1,
      12,
      "Mevcut dönem",
      true,
    ),
    graduationSemester: number(
      Object.hasOwn(input.profile, "graduationSemester")
        ? input.profile.graduationSemester
        : 10,
      1,
      12,
      "Mezuniyet dönemi",
      true,
    ),
  };
  if (state.profile.graduationSemester < state.profile.currentSemester)
    fail("Mezuniyet dönemi mevcut dönemden önce olamaz.");
  const baseCourses = catalogCourses(catalog);
  const knownIds = new Set(baseCourses.map((course) => course.id));
  state.customCourses = list(input.customCourses, 0, 100, "Özel dersler").map(
    (course, index) => {
      const label = `Özel ders ${index + 1}`;
      const allowed = [
        "id",
        "code",
        "name",
        "credits",
        "semester",
        "major",
        "minor",
        "kind",
      ];
      fields(course, allowed, allowed, label);
      const courseId = id(course.id, `${label} kimliği`);
      if (knownIds.has(courseId)) fail(`Yinelenen ders kimliği: ${courseId}.`);
      knownIds.add(courseId);
      return {
        id: courseId,
        ...courseFields(course, label),
        semester: number(course.semester, 1, 12, `${label} dönemi`, true),
        kind: string(course.kind, 40, `${label} türü`),
      };
    },
  );
  if (knownIds.size > MAX_COURSES)
    fail("Toplam ders sayısı 500 değerini geçemez.");
  function entries(value, label) {
    record(value, label);
    if (Object.keys(value).length > MAX_COURSES)
      fail(`${label}: çok fazla ders.`);
    for (const key of Object.keys(value)) {
      if (!knownIds.has(key))
        fail(
          `${label}: “${key}” katalogda bulunamadı. Önce customCourses listesine ekleyin.`,
        );
    }
    return Object.entries(value);
  }
  state.courseOverrides = Object.fromEntries(
    entries(input.courseOverrides, "Ders düzenlemeleri").map(
      ([courseId, value]) => {
        fields(
          value,
          ["code", "name", "credits", "major", "minor", "semester"],
          [],
          `${courseId} düzenlemesi`,
        );
        return [courseId, courseFields(value, courseId)];
      },
    ),
  );
  const resolvedCourses = new Map();
  const courseCodes = new Map();
  for (const course of resolveCourses(state, baseCourses)) {
    const code = string(course.code, 40, `${course.id} ders kodu`)
      .replace(/\s+/g, "")
      .toUpperCase();
    if (courseCodes.has(code)) {
      fail(
        `Aynı ders kodu birden fazla kayıtta kullanılamaz: ${course.code} (${courseCodes.get(code)} ve ${course.id}). Anadal ve yandal için aynı ders kaydını kullanın.`,
      );
    }
    courseCodes.set(code, course.id);
    resolvedCourses.set(course.id, course);
  }
  state.transcript = Object.fromEntries(
    entries(input.transcript, "Transkript").map(([courseId, value]) => [
      courseId,
      grade(value, courseId),
    ]),
  );
  const scenarioIds = new Set();
  state.scenarios = list(input.scenarios, 1, 20, "Senaryolar").map(
    (scenario, index) => {
      const label = `Senaryo ${index + 1}`;
      fields(
        scenario,
        ["id", "name", "courses"],
        ["id", "name", "courses"],
        label,
      );
      const scenarioId = id(scenario.id, `${label} kimliği`);
      if (scenarioIds.has(scenarioId))
        fail(`Yinelenen senaryo kimliği: ${scenarioId}.`);
      scenarioIds.add(scenarioId);
      const courses = Object.fromEntries(
        entries(scenario.courses, label).map(([courseId, value]) => {
          fields(
            value,
            ["grade", "term", "distribution", "assessments", "examTarget"],
            ["grade", "term"],
            `${label} ${courseId}`,
          );
          const plan = {
            grade: grade(value.grade, `${label} ${courseId}`, true),
            term: number(
              value.term,
              1,
              12,
              `${label} ${courseId} dönemi`,
              true,
            ),
          };
          if (Object.hasOwn(value, "distribution"))
            plan.distribution = distribution(
              value.distribution,
              `${label} ${courseId}`,
            );
          const course = resolvedCourses.get(courseId);
          if (plan.distribution && course.credits === 0)
            fail(
              `${label} ${course.code}: sıfır kredili ders için harf notu olasılığı kullanılamaz.`,
            );
          if (
            (plan.grade || plan.distribution) &&
            Object.hasOwn(state.transcript, courseId) &&
            plan.term <= course.semester
          ) {
            fail(
              `${label} ${course.code}: tekrar planı, gerçekleşmiş notun ${course.semester}. döneminden sonra olmalı. Daha ileri bir dönem seçin veya eski tahmini kaldırın.`,
            );
          }
          if (Object.hasOwn(value, "assessments")) {
            plan.assessments = list(
              value.assessments,
              0,
              20,
              `${courseId} sınavları`,
            ).map((assessment, assessmentIndex) => {
              const examLabel = `${courseId} sınav ${assessmentIndex + 1}`;
              fields(
                assessment,
                ["name", "weight", "score"],
                ["name", "weight", "score"],
                examLabel,
              );
              return {
                name: string(assessment.name, 80, `${examLabel} adı`),
                weight: number(
                  assessment.weight,
                  0,
                  100,
                  `${examLabel} ağırlığı`,
                ),
                score:
                  assessment.score === null
                    ? null
                    : number(assessment.score, 0, 100, `${examLabel} puanı`),
              };
            });
          }
          if (Object.hasOwn(value, "examTarget"))
            plan.examTarget = number(
              value.examTarget,
              0,
              100,
              `${courseId} sınav hedefi`,
            );
          return [courseId, plan];
        }),
      );
      return {
        id: scenarioId,
        name: string(scenario.name, 80, `${label} adı`),
        courses,
      };
    },
  );
  state.activeScenarioId = id(input.activeScenarioId, "Aktif senaryo kimliği");
  if (!scenarioIds.has(state.activeScenarioId))
    fail("Aktif senaryo, senaryolar listesinde bulunamadı.");
  state.example = Object.hasOwn(input, "example")
    ? boolean(input.example, "Örnek veri seçimi")
    : false;
  assertSize(JSON.stringify(state));
  return state;
}

function assertSize(text) {
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES)
    fail("JSON dosyası en fazla 2 MB olabilir.");
}

export function parseImport(text, catalog) {
  if (typeof text !== "string") fail("İçe aktarmak için JSON metni gerekli.");
  assertSize(text);
  let source = text.trim().replace(/^\uFEFF/, "");
  const fenced = source.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fenced) source = fenced[1].trim();
  let input;
  try {
    input = JSON.parse(source);
  } catch {
    fail(
      "JSON okunamadı. Yalnızca JSON metnini (veya tek bir JSON kod bloğunu) yapıştırın.",
    );
  }
  return validateState(input, catalog);
}

export function exportJSON(state) {
  const text = JSON.stringify(state, null, 2);
  assertSize(text);
  return text;
}

export function migrateLegacy(grades, group, catalog) {
  checkTree(grades);
  record(grades, "Eski not kaydı");
  if (Object.keys(grades).length > MAX_COURSES * 8)
    fail("Eski not kaydı çok büyük.");
  const state = createState();
  if (
    group !== null &&
    group !== undefined &&
    group !== "" &&
    !["A", "B"].includes(group)
  )
    fail("Eski kayıttaki soyadı grubu geçersiz.");
  state.profile.group = group || "A";
  const normalizeCode = (value) => value.replace(/\s+/g, "").toUpperCase();
  const byCode = new Map(
    catalogCourses(catalog).map((course) => [
      normalizeCode(course.code),
      course.id,
    ]),
  );
  const sources = new Map();
  for (const [key, value] of Object.entries(grades)) {
    if (value === "N/A" || value === "") continue;
    const match = key.match(/^[1-8]-(.+)$/);
    const courseId = match && byCode.get(normalizeCode(match[1]));
    if (!courseId)
      fail(`Eski kayıttaki “${key}” dersi tanınmadı. Eski kayıt korundu.`);
    grade(value, key);
    if (
      Object.hasOwn(state.transcript, courseId) &&
      state.transcript[courseId] !== value
    ) {
      fail(
        `Eski kayıtta ${match[1]} için çelişen notlar var: ${sources.get(courseId)} = ${state.transcript[courseId]}, ${key} = ${value}. Hangi notun güncel olduğunu seçerek yeniden girin. Eski kayıt korundu.`,
      );
    }
    state.transcript[courseId] = value;
    sources.set(courseId, key);
  }
  return validateState(state, catalog);
}

export function loadState(storage, catalog) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
    if (raw !== null) {
      try {
        return { state: parseImport(raw, catalog), notice: "" };
      } catch (error) {
        pendingRecovery.set(storage, raw);
        return {
          state: createState(),
          notice:
            "Tarayıcıdaki kayıt okunamadı. Yeni, boş bir plan açıldı; eski kayıt korundu.",
          error: error.message,
        };
      }
    }
    const legacy = storage.getItem(LEGACY_GRADES_KEY);
    if (legacy !== null) {
      assertSize(legacy);
      let grades;
      try {
        grades = JSON.parse(legacy);
      } catch {
        fail("Eski not kaydı geçerli JSON değil. Eski kayıt korundu.");
      }
      return {
        state: migrateLegacy(
          grades,
          storage.getItem(LEGACY_GROUP_KEY),
          catalog,
        ),
        notice:
          "Önceki uygulamadaki notlar aktarıldı. Eski tarayıcı kaydı da korundu; lütfen notlarınızı kontrol edin.",
      };
    }
    return { state: createState(), notice: "" };
  } catch (error) {
    return {
      state: createState(),
      notice:
        "Tarayıcı kaydı yüklenemedi. Bu oturumda çalışabilir ve JSON yedeği alabilirsiniz.",
      error: error.message,
    };
  }
}

export function saveState(storage, state) {
  try {
    const text = exportJSON(state);
    let recoveryKey;
    if (pendingRecovery.has(storage)) {
      recoveryKey = `${STORAGE_KEY}.recovery.${Date.now()}`;
      let suffix = 0;
      while (storage.getItem(recoveryKey) !== null)
        recoveryKey = `${STORAGE_KEY}.recovery.${Date.now()}.${++suffix}`;
      storage.setItem(recoveryKey, pendingRecovery.get(storage));
      pendingRecovery.delete(storage);
    }
    storage.setItem(STORAGE_KEY, text);
    return { ok: true, ...(recoveryKey ? { recoveryKey } : {}) };
  } catch {
    return {
      ok: false,
      error:
        "Bu tarayıcıya kaydedilemedi. Depolama kapalı veya dolu olabilir. Verilerinizi korumak için JSON kopyalayın ya da indirin.",
    };
  }
}

export function chatGPTPrompt(state, catalog) {
  const valid = validateState(state, catalog);
  const courses = resolveCourses(valid, catalogCourses(catalog)).map(
    (course) => ({
      id: course.id,
      code: course.code,
      name: course.name,
      credits: course.credits,
      semester: course.semester ?? null,
      major: Boolean(course.major),
      minor: Boolean(course.minor),
      ...(course.gpa === false ? { gpa: false } : {}),
      ...valid.courseOverrides[course.id],
    }),
  );
  return `ODTÜ Makine Mühendisliği ve Mekatronik yandal planımı karşılaştırmama yardım et.

İsteğim: [Hedefimi ve denemek istediğim senaryoyu buraya yazacağım. Örneğin: PHYS 105 notumu BB'den AA'ya yükseltmek mezuniyet GNO'mu ne kadar değiştirir?]

Kurallar:
- Aşağıdaki kayıt benim girdiğim plan verisidir. Gerçekleşmiş notlar transcript içindedir. Varsayımları gerçekleşmiş sonuç gibi sunma.
- transcript, profile, courseOverrides ve customCourses alanlarını değiştirme. Yalnızca scenarios ve activeScenarioId alanlarını değiştir. Diğer üst düzey alanları koru.
- Senaryoları ayrı tut. Bir derse ait senaryo notu mevcut transkript notunun yerine geçer; iki kez sayılmaz. Not yükseltmek için ders tekrarında son not esas alınır; düşük sonuç riskini de göster.
- Anadal GNO'sunu ve yandal GNO'sunu ayrı hesapla. major/minor işaretlerini kullan; ikisine de sayılan ders her programda bir kez sayılır. Krediler yerel ODTÜ kredileridir, AKTS değildir.
- AA=4, BA=3.5, BB=3, CB=2.5, CC=2, DC=1.5, DD=1, FD=0.5, FF=0, NA=0. S/U/EX/I/W GNO hesabına girmez; S ve EX tamamlandı, U başarısız demektir. I/W tamamlanmış sayılmaz. Boş not '' henüz planlanmamış demektir.
- Her plan dersi grade ve term (1–12 arasında tam sayı) içersin. term mutlak akademik dönemdir: 1 ilk güz, 2 ilk bahar, 9 beşinci yıl güz, 10 beşinci yıl bahar demektir. Mevcut dönem profile.currentSemester, planlanan mezuniyet profile.graduationSemester içindedir. Aynı ders için bir senaryoda yalnızca bir plan notu bulunabilir.
- Yalnızca mevcut ve gelecek dönemler için tahmin üret. Transkriptteki geçmiş notları değiştirme; geçmiş derse yeni not denemek için mevcut/gelecek döneme tekrar planı ekle. Transkriptte notu bulunan dersin tekrar planı, çözümlenmiş katalogdaki semester değerinden kesinlikle büyük bir term içermeli. Rastgele not veya olasılık üretirken yalnızca senaryoları değiştir, transcript alanını asla değiştirme.
- İsteğe bağlı distribution alanı AA/BA/BB/CB/CC/DC/DD/FD/FF/NA anahtarlarıyla 0–100 yüzdeleri içerir. Toplam tam %100 olmalı. Olasılıklar kullanıcının varsayımlarıdır; gerçek başarı tahmini değildir. Ders sonuçları bağımsız varsayılır.
- İsteğe bağlı assessments: [{name, weight, score}] alanında weight yüzde (0–100), score 0–100 veya bilinmeyen için null olur. examTarget 0–100 puandır. Eksik ya da %100 olmayan ağırlıkları tamamlanmış hesap gibi sunma. Sınav ortalamasını otomatik bir harf notuna çevirme; dersin gerçek harf notu sınırları bilinmiyor.
- Katalogda olmayan ders kimliği kullanma. Aynı gerçek ders için ikinci bir ders kaydı oluşturma. Sıfır kredili derslere distribution ekleme. En fazla 20 senaryo oluştur. Yeni senaryo kimliği benzersiz olsun. activeScenarioId mevcut bir senaryoya işaret etsin.
- Derslerin dönem bilgisi öneridir. Ön koşullar, açılma durumu, tekrar izni ve resmi yandal saydırma kararları bu araç tarafından onaylanmaz.
- Sonuçta uygulamaya yapıştırılabilecek TEK tam JSON nesnesi döndür. schemaVersion 2 olmalı. Yeni alan ekleme. Açıklamaları JSON içine ekleme.

Çözümlenmiş ders kataloğu (yalnızca başvuru; döndürdüğün JSON'a ekleme):
${JSON.stringify(courses, null, 2)}

Mevcut uygulama JSON'u:
${exportJSON(valid)}`;
}
