import {
  courses as baseCourses,
  sources,
  minorRules,
  minorOptions,
  minorRequiredAlternatives,
  restrictedOptions,
} from "./curriculum.js";
import {
  gradePoints,
  letterGrades,
  isPassed,
  stats,
  project,
  targetRequirement,
  retakeImpact,
  probabilityForecast,
  weightedExams,
  semesterForecast,
} from "./engine.js";
import {
  createState,
  loadState,
  saveState,
  validateState,
  parseImport,
  exportJSON,
  chatGPTPrompt,
} from "./state.js";

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const num = (value, digits = 2) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("tr-TR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
const sign = (value) =>
  value == null ? "—" : `${value >= 0 ? "+" : "−"}${num(Math.abs(value), 3)}`;
const icons = {
  compass: '<path d="m16 4-3 9-9 3 3-9z"/><circle cx="10" cy="10" r="1"/>',
  grid: '<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="12" y="3" width="5" height="5" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="12" width="5" height="5" rx="1"/>',
  book: '<path d="M10 5C8 3 5 3 2 4v12c3-1 6-1 8 1 2-2 5-2 8-1V4c-3-1-6-1-8 1v12"/>',
  branch:
    '<circle cx="5" cy="4" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="5" cy="16" r="2"/><path d="M5 6v8m0-4h5a5 5 0 0 0 5-3"/>',
  repeat:
    '<path d="M16 7A7 7 0 0 0 4 5L2 7m0-5v5h5m-3 6a7 7 0 0 0 12 2l2-2m0 5v-5h-5"/>',
  chart: '<path d="M3 3v14h15M6 12l4-5 4 3 4-7"/>',
  chip: '<rect x="5" y="5" width="10" height="10" rx="2"/><path d="M8 1v4m4-4v4m-4 10v4m4-4v4M1 8h4m-4 4h4m10-4h4m-4 4h4"/>',
  arrow: '<path d="M3 10h14m-5-5 5 5-5 5"/>',
  plus: '<path d="M10 3v14M3 10h14"/>',
  check: '<path d="m4 10 4 4 8-9"/>',
  close: '<path d="m5 5 10 10M15 5 5 15"/>',
  data: '<path d="M7 4 2 10l5 6m6-12 5 6-5 6m-2-14-2 16"/>',
  download: '<path d="M10 2v11m-4-4 4 4 4-4M3 14v4h14v-4"/>',
  search: '<circle cx="8" cy="8" r="5"/><path d="m12 12 5 5"/>',
  info: '<circle cx="10" cy="10" r="8"/><path d="M10 9v5m0-9v1"/>',
  edit: '<path d="m13 3 4 4-9 9-5 1 1-5zM11 5l4 4"/>',
  undo: '<path d="M6 5 2 9l4 4M2 9h10a5 5 0 0 1 0 10"/>',
  copy: '<rect x="7" y="7" width="10" height="11" rx="2"/><path d="M12 7V2H2v11h5"/>',
  spark: '<path d="m10 2 2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
  lock: '<rect x="4" y="9" width="12" height="9" rx="2"/><path d="M6 9V6a4 4 0 0 1 8 0v3"/>',
  circle: '<circle cx="10" cy="10" r="7"/><path d="M10 3v7l5 3"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.circle}</svg>`;
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = {
    getItem() {
      throw Error("Tarayıcı depolaması kapalı.");
    },
    setItem() {
      throw Error("Tarayıcı depolaması kapalı.");
    },
  };
}
const loaded = loadState(storage, baseCourses);
let state = loaded.state;
let notice = loaded.notice || loaded.error || "";
let saveError = "";
const history = [];
const ui = {
  page: "scenarios",
  year: "1",
  search: "",
  status: "all",
  program: "all",
  retakeId: "PHYS105",
  retakeGrade: "AA",
  examId: "",
  planView: "board",
  showHistory: false,
};
let toastTimer;
const navItems = [
  ["scenarios", "branch", "Senaryolarım"],
  ["transcript", "book", "Transkriptim"],
  ["overview", "grid", "Genel bakış"],
  ["retakes", "repeat", "Ders tekrarı"],
  ["exams", "chart", "Sınav hesabı"],
  ["minor", "chip", "Mekatronik yandal"],
];
function allCourses() {
  return [...baseCourses, ...state.customCourses].map((course) => ({
    ...course,
    ...state.courseOverrides[course.id],
  }));
}
function visibleCourses() {
  return allCourses().filter(
    (course) => state.profile.minorEnabled || course.major,
  );
}
function activeScenario() {
  return state.scenarios.find(
    (scenario) => scenario.id === state.activeScenarioId,
  );
}
function actual(program = "major") {
  return stats(allCourses(), state.transcript, program);
}
function predicted(program = "major") {
  return project(allCourses(), state.transcript, activeScenario(), program);
}
function hasData() {
  return Object.keys(state.transcript).length > 0;
}
function hasUserWork() {
  return JSON.stringify(state) !== JSON.stringify(createState());
}
function entry(id) {
  return plannedEntry(id);
}
function newId(prefix) {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8)}`;
}
function persist() {
  const result = saveState(storage, state);
  saveError =
    result?.ok === false
      ? result.error || "Bu tarayıcıda kaydedilemedi. Verilerini dışa aktar."
      : "";
}
function mutate(change, message = "") {
  const before = structuredClone(state);
  try {
    change();
    state = validateState(state, baseCourses);
    if (!state.profile.minorEnabled) {
      ui.program = "major";
      if (ui.page === "minor") ui.page = "overview";
    }
    history.push(before);
    if (history.length > 30) history.shift();
    persist();
    render();
    if (message) toast(message);
  } catch (error) {
    state = before;
    toast(error.message, true);
  }
}
function toast(message, error = false) {
  const el = $("#toast");
  el.textContent = message;
  el.className = `visible ${error ? "error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = "";
  }, 5500);
}
function go(page) {
  ui.page = page;
  ui.program = page === "scenarios" ? "all" : "major";
  ui.search = "";
  ui.status = "all";
  closeDialog();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  $("#page-heading")?.focus({ preventScroll: true });
}
function render() {
  const focus = document.activeElement;
  const focusId = focus?.id;
  const selection =
    focus?.tagName === "INPUT" && focus.type === "text"
      ? focus.selectionStart
      : null;
  const pages = {
    overview: overviewPage,
    transcript: transcriptPage,
    scenarios: scenariosPage,
    retakes: retakesPage,
    exams: examsPage,
    minor: minorPage,
  };
  $("#app").innerHTML = `<aside class="sidebar">
    <a href="#scenarios" class="brand" data-page="scenarios">Not planı</a>
    <nav aria-label="Ana menü">${navItems
      .filter(([id]) => id !== "minor" || state.profile.minorEnabled)
      .map(
        ([id, i, label]) =>
          `<button class="nav-item ${ui.page === id ? "active" : ""}" data-page="${id}" ${ui.page === id ? 'aria-current="page"' : ""}>${icon(i)}<span>${label}</span></button>`,
      )
      .join("")}</nav>
    <div class="sidebar-bottom"><div class="private-note">${icon("lock")}<span>Notların bu tarayıcıda kaydedilir.</span></div><button class="nav-item" data-action="data">${icon("data")}<span>Verilerim & paylaşım</span></button><button class="nav-item" data-action="settings">${icon("compass")}<span>Ayarlar & kaynaklar</span></button></div>
  </aside>
  <div class="main-shell"><header class="topbar"><div class="breadcrumb">Makina Mühendisliği <span>/</span> <strong>${navItems.find(([id]) => id === ui.page)[2]}</strong></div><div class="topbar-actions"><span class="save-status ${saveError ? "warning-text" : ""}">${saveError ? "Kayıt başarısız" : "Bu tarayıcıda saklanır"}</span><button class="icon-button" data-action="undo" aria-label="Son değişikliği geri al" title="Son değişikliği geri al" ${!history.length ? "disabled" : ""}>${icon("undo")}</button><button class="icon-button" data-action="settings" aria-label="Plan ayarları" title="Plan ayarları">${icon("compass")}</button><button class="button small secondary" data-action="data">${icon("download")}<span>Yedekle / aktar</span></button></div></header>
  <main id="main" class="${ui.page === "scenarios" ? "planner-main" : ""}">
    ${state.example ? '<div class="banner demo-banner"><span><strong>Örnek öğrenci verileri.</strong> Bu notlar sana ait değil; özgürce deneyebilirsin.</span><button data-action="clear-example">Kendi notlarımla başla ' + icon("arrow") + "</button></div>" : ""}
    ${notice ? `<div class="banner"><span>${esc(notice)}</span><button class="icon-button" data-action="dismiss-notice" aria-label="Bildirimi kapat">${icon("close")}</button></div>` : ""}
    ${saveError ? `<div class="banner error-banner" role="alert">${esc(saveError)} Verilerim panelinden bir yedek al.</div>` : ""}
    ${pages[ui.page]()}
    <footer class="main-footer"><button data-action="sources">Hesaplama yöntemi & resmi kaynaklar ${icon("arrow")}</button></footer>
  </main></div>`;
  if (focusId) {
    const replacement = document.getElementById(focusId);
    replacement?.focus({ preventScroll: true });
    if (selection !== null && replacement?.setSelectionRange)
      replacement.setSelectionRange(selection, selection);
  }
}
function pageHeading(title, description, actions = "") {
  return `<div class="page-heading"><div><h1 id="page-heading" tabindex="-1">${title}</h1><p>${description}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ""}</div>`;
}
function statCard(label, value, foot, extra = "", cls = "") {
  return `<article class="stat-card ${cls}"><div class="stat-label">${label}${extra}</div><div class="stat-number">${value}</div><div class="stat-foot">${foot}</div></article>`;
}
function scenarioSelect() {
  return `<label class="scenario-picker">${icon("branch")}<select id="active-scenario" aria-label="Aktif senaryo">${state.scenarios.map((s) => `<option value="${esc(s.id)}" ${s.id === state.activeScenarioId ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>`;
}
function overviewPage() {
  const a = actual(),
    p = predicted(),
    m = actual("minor");
  const target = targetRequirement(
    allCourses(),
    state.transcript,
    activeScenario(),
    state.profile.target,
  );
  const pct = a.requiredCredits
    ? Math.round((a.earnedCredits / a.requiredCredits) * 100)
    : 0;
  const delta = a.gpa !== null && p.gpa !== null ? p.gpa - a.gpa : null;
  return `${pageHeading("Not ortalaman", "Gerçek notların ve seçili senaryonun özeti.", scenarioSelect())}
  ${
    !hasData()
      ? `<section class="welcome-card"><div class="welcome-copy"><h2>Notlarını girerek başla</h2><p>Aldığın derslerin notlarını gir, kalan dersler için farklı tahminler dene.</p><div class="button-row"><button class="button primary" data-page="transcript">Notları gir ${icon("arrow")}</button><button class="button secondary" data-action="example">Örnekle dene</button></div></div></section>`
      : ""
  }
  <section class="stats-grid" aria-label="Not özeti">
    ${statCard("Şu anki ortalaman", num(a.gpa), `${num(a.gpaCredits, 0)} kredilik girilmiş not`, icon("book"))}
    ${statCard("Senaryo sonu ortalaman", num(p.gpa), p.plannedCount ? `${sign(delta)} puan · ${p.plannedCount} ders varsayımı` : "Henüz bir tahmin eklemedin", icon("branch"), "tinted")}
    ${statCard("Anadalda kalan kredi", num(a.remainingCredits, 0), `${a.remainingCount} ders / gereklilik · ${pct}% kredi tamamlandı`, icon("circle"))}
    ${statCard(state.profile.minorEnabled ? "Yandal ortalaman" : "Hedef ortalaman", state.profile.minorEnabled ? num(m.gpa) : num(state.profile.target), state.profile.minorEnabled ? "Anadaldan ayrı hesaplanır" : "Hedefini aşağıdan değiştirebilirsin", icon("chip"))}
  </section>
  <div class="dashboard-columns"><section class="panel trajectory-panel"><div class="panel-heading"><span class="pill neutral">${p.plannedCount} planlanan ders</span></div><h2>Dönemlere göre ortalama</h2><p class="muted">Seçtiğin dersler eklendikçe anadal ortalaman.</p>${trajectoryChart()}<div class="chart-legend"><span><i class="legend-dot"></i>Mevcut + senaryo</span><span><i class="legend-line"></i>Hedef: ${num(state.profile.target)}</span></div>${p.remainingUnplanned ? `<div class="inline-note">${icon("info")} ${p.remainingUnplanned} anadal gerekliliği henüz planlanmadı. Bu sonuç tam mezuniyet tahmini değil.</div>` : `<div class="inline-note">${icon("info")} Ders planı hesabıdır; mezuniyet onayı yerine geçmez.</div>`}</section>
  <section class="panel goal-panel"><h2>Hedef ortalama</h2><label class="target-label" for="target-gpa">Hedef genel not ortalaması <output>${num(state.profile.target)}</output></label><input id="target-gpa" type="range" min="2" max="4" step=".05" value="${state.profile.target}"><div class="range-labels"><span>2,00</span><span>3,00</span><span>4,00</span></div><div class="goal-result">${target.remainingCredits > 0 ? `<span>Kalan ${num(target.remainingCredits, 0)} kredide gereken ortalama</span><strong>${num(target.requiredAverage)}</strong><p>${target.requiredAverage > 4 ? "Bu planla hedef 4,00 üstü gerektiriyor. Bir ders tekrarı veya başka bir hedef deneyebilirsin." : target.requiredAverage <= 0 ? "Mevcut varsayımların hedefi karşılıyor. Kalan dersleri de geçmen gerekir." : "Seçtiğin tahminlerin beklenen değeriyle. Tekrarlar da hesaba katılır."}</p>` : `<span>${p.plannedCount ? "Bu planın hedefe göre durumu" : "Planlamak için notlarını gir"}</span><strong>${p.gpa == null ? "—" : p.gpa >= state.profile.target ? "Hedefte" : "Hedef altında"}</strong><p>Tahminleri veya ders tekrarlarını değiştirebilirsin.</p>`}</div><button class="button primary full-width" data-page="scenarios">Senaryoları aç ${icon("arrow")}</button></section></div>
  <div class="section-title"><div><h2>Hesaplamalar</h2></div></div><div class="question-grid">
    ${questionCard("repeat", "Ders tekrarı", "Yeni notun bugünkü ve plan sonu ortalamana etkisini gör.", "retakes", "sage")}
    ${questionCard("chart", "Sınav hesabı", "Vize, ödev ve final ağırlıklarını gir. İhtiyacın olan notu hemen bul.", "exams", "peach")}
    ${questionCard("branch", "Dönem planı", "Farklı planlar oluştur, yan yana karşılaştır. Gerçek notlarına dokunmadan.", "scenarios", "cream")}
  </div>`;
}
function questionCard(i, title, description, page, color) {
  return `<button class="question-card ${color}" data-page="${page}"><span class="question-icon">${icon(i)}</span><h3>${title}</h3><p>${description}</p><span class="question-arrow">Aç ${icon("arrow")}</span></button>`;
}
function trajectoryChart() {
  const courses = allCourses(),
    scenario = activeScenario(),
    a = actual();
  const terms = Object.values(scenario.courses).filter(
    (e) => e.grade || e.distribution,
  );
  const schedule = semesterForecast(
    courses.map((c) => ({ ...c, semester: courseSemester(c) })),
    state.transcript,
    scenario,
    state.profile,
  );
  const values = [
    { label: "Şimdi", value: a.gpa },
    ...schedule
      .filter((t) => t.term >= state.profile.currentSemester)
      .map((t) => ({
        label: `${t.term}. dönem`,
        value: t.major.cumulativeGpa,
      })),
  ];
  const w = 660,
    h = 220,
    left = 45,
    right = 22,
    top = 20,
    bottom = 38;
  const x = (i) =>
      left + (i * (w - left - right)) / Math.max(1, values.length - 1),
    y = (value) => top + ((4 - value) / 4) * (h - top - bottom);
  const valid = values
    .map((d, i) => ({ ...d, x: x(i) }))
    .filter((d) => d.value !== null);
  const path = valid
    .map((d, i) => `${i ? "L" : "M"}${d.x},${y(d.value)}`)
    .join(" ");
  return `<div class="chart-wrap"><svg class="trajectory" viewBox="0 0 ${w} ${h}" role="img" aria-label="Mevcut ortalama ve planlanan dönemlere göre ortalama: ${values.map((v) => `${v.label} ${num(v.value)}`).join(", ")}"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#762b43" stop-opacity=".18"/><stop offset="100%" stop-color="#762b43" stop-opacity="0"/></linearGradient></defs>${[0, 1, 2, 3, 4].map((v) => `<line x1="${left}" y1="${y(v)}" x2="${w - right}" y2="${y(v)}" class="grid-line"/><text x="${left - 14}" y="${y(v) + 4}" text-anchor="end">${v},0</text>`).join("")}<line x1="${left}" y1="${y(state.profile.target)}" x2="${w - right}" y2="${y(state.profile.target)}" class="target-line"/>${valid.length > 1 ? `<path d="${path} L${valid.at(-1).x},${h - bottom} L${valid[0].x},${h - bottom}Z" fill="url(#chartFill)"/>` : ""}<path d="${path}" class="forecast-line"/>${valid.map((d) => `<circle cx="${d.x}" cy="${y(d.value)}" r="5" class="forecast-dot"/><text class="point-label" x="${d.x}" y="${y(d.value) - 14}" text-anchor="middle">${num(d.value)}</text>`).join("")}${values.map((v, i) => `<text x="${x(i)}" y="${h - 10}" text-anchor="middle">${v.label}</text>`).join("")}</svg>${!terms.length ? `<div class="chart-empty"><span>${icon("branch")}</span><strong>Henüz tahmin girilmedi</strong><p>Derslerine tahmini not eklediğinde grafik güncellenir.</p><button class="button small secondary" data-page="scenarios">Dersleri planla ${icon("arrow")}</button></div>` : ""}</div>`;
}
function gradeSelect(id, value, mode, noncredit = false) {
  const options = noncredit
    ? ["", "S", "U", "EX", "I", "W"]
    : ["", ...letterGrades, "S", "U", "EX", "I", "W"];
  return `<select id="${mode}-${esc(id)}" class="grade-select ${isPassed(value) ? "passed" : value && ["FF", "FD", "NA", "U"].includes(value) ? "failed" : ""}" data-grade="${mode}" data-id="${esc(id)}" aria-label="${esc(allCourses().find((c) => c.id === id)?.code || id)} ${mode === "actual" ? "gerçek notu" : "tahmini notu"}">${options.map((g) => `<option value="${g}" ${value === g ? "selected" : ""}>${g || (mode === "actual" ? "Not yok" : "Seç…")}</option>`).join("")}</select>`;
}
function filters(transcript = true) {
  return `<div class="table-toolbar"><label class="search-box">${icon("search")}<input id="course-search" type="text" placeholder="Ders kodu veya adı ara…" aria-label="Ders ara" value="${esc(ui.search)}"></label><div class="filter-controls"><select id="program-filter" aria-label="Program filtresi"><option value="major" ${ui.program === "major" ? "selected" : ""}>Anadal</option>${state.profile.minorEnabled ? `<option value="minor" ${ui.program === "minor" ? "selected" : ""}>Yandal</option><option value="all" ${ui.program === "all" ? "selected" : ""}>Tüm dersler</option>` : ""}</select><select id="status-filter" aria-label="Ders durumu filtresi"><option value="all">Tüm durumlar</option><option value="remaining" ${ui.status === "remaining" ? "selected" : ""}>${transcript ? "Kalan dersler" : "Henüz planlanmayan"}</option><option value="graded" ${ui.status === "graded" ? "selected" : ""}>${transcript ? "Not girilenler" : "Planlananlar"}</option><option value="failed" ${ui.status === "failed" ? "selected" : ""}>Tekrar gerekenler</option></select></div></div>`;
}
function courseSemester(course) {
  if (state.courseOverrides[course.id]?.semester)
    return state.courseOverrides[course.id].semester;
  if (state.profile.group === "B") {
    if (course.id === "ME117") return 2;
    if (course.id === "ME110") return 1;
    if (course.id === "METE230") return 4;
  }
  return course.semester;
}
function filteredCourses(transcript = true) {
  return visibleCourses()
    .filter((c) => ui.program === "all" || c[ui.program])
    .filter(
      (c) =>
        !ui.search ||
        `${c.code} ${c.name}`
          .toLocaleLowerCase("tr")
          .includes(ui.search.toLocaleLowerCase("tr")),
    )
    .filter((c) => {
      const g = state.transcript[c.id];
      if (ui.status === "remaining")
        return transcript
          ? !isPassed(g)
          : !entry(c.id).grade && !entry(c.id).distribution;
      if (ui.status === "graded")
        return transcript
          ? Boolean(g)
          : Boolean(entry(c.id).grade || entry(c.id).distribution);
      if (ui.status === "failed") return Boolean(g) && !isPassed(g);
      return true;
    })
    .filter(
      (c) =>
        !transcript ||
        ui.year === "all" ||
        ui.search ||
        Math.ceil(courseSemester(c) / 2) === Number(ui.year) ||
        (!c.major && ui.program === "minor"),
    );
}
function transcriptPage() {
  const a = actual(),
    rows = filteredCourses();
  return `${pageHeading("Transkriptim", "Transkriptindeki son geçerli notları gir. Tahminlerini Senaryolarım’da dene.", `<button class="button secondary" data-action="add-course">${icon("plus")} Ders ekle</button>`)}
  <div class="compact-summary"><span>${icon("book")} <strong>${num(a.gpa)}</strong> mevcut GNO</span><span><strong>${num(a.earnedCredits, 0)} / ${num(a.requiredCredits, 0)}</strong> tamamlanan anadal kredisi</span><span><strong>${Object.keys(state.transcript).length}</strong> not girildi</span><button data-action="data">Notları yapıştır / içe aktar ${icon("arrow")}</button></div>
  <div class="panel table-panel"><div class="table-top"><div class="tabs" aria-label="Sınıf filtresi">${[
    ["1", "1. sınıf"],
    ["2", "2. sınıf"],
    ["3", "3. sınıf"],
    ["4", "4. sınıf"],
    ["all", "Tümü"],
  ]
    .map(
      ([id, label]) =>
        `<button data-year="${id}" class="tab ${ui.year === id ? "active" : ""}" aria-pressed="${ui.year === id}">${label}</button>`,
    )
    .join(
      "",
    )}</div><button class="subtle-link" data-action="settings">Soyadı grubu: ${state.profile.group === "A" ? "A–KA" : "KA–Z"}</button></div>${filters()}
  <div class="table-scroll"><table class="course-table"><thead><tr><th scope="col">Ders</th><th scope="col">Kredi</th><th scope="col">Notun</th><th scope="col"><span class="sr-only">Düzenle</span></th></tr></thead><tbody>${rows.map((c) => `<tr><td><div class="course-title"><span class="course-code">${esc(c.code)}</span>${c.minor && state.profile.minorEnabled ? '<span class="mini-badge">YANDAL' + (c.major ? " · ORTAK" : "") + "</span>" : ""}</div><div class="course-name">${esc(c.name)}</div>${c.placeholder ? '<span class="row-hint">Seçmeli dersi düzenle düğmesinden seç</span>' : ""}</td><td class="credit-cell">${c.credits || "Kredisiz"}</td><td>${gradeSelect(c.id, state.transcript[c.id] || "", "actual", c.credits === 0)}</td><td><button class="icon-button" data-action="edit-course" data-id="${esc(c.id)}" aria-label="${esc(c.code)} dersini düzenle">${icon("edit")}</button></td></tr>`).join("") || '<tr><td colspan="4" class="empty-cell">Bu filtrelerle eşleşen ders yok.</td></tr>'}</tbody></table></div><div class="table-footer"><span>${rows.length} ders gösteriliyor</span><span>Yerel kredi kullanılır; AKTS değil</span></div></div>
  <div class="info-grid"><div class="inline-note">${icon("info")} FF, FD ve NA ortalamaya girer; tamamlanmış kredi sayılmaz. S / EX ortalamaya girmez. I / W dersin tamamlandığı anlamına gelmez.</div><div class="inline-note">${icon("lock")} Notların bu tarayıcıda kalır. Başka cihaza geçmeden “Yedekle / aktar” ile bir kopya al.</div></div>`;
}
function scenariosPage() {
  const p = predicted(),
    a = actual(),
    scenario = activeScenario(),
    rows = filteredCourses(false);
  const uncertain = allCourses().some(
    (c) => c.major && scenario.courses[c.id]?.distribution,
  );
  const minorUncertain =
    state.profile.minorEnabled &&
    allCourses().some((c) => c.minor && scenario.courses[c.id]?.distribution);
  return `<div class="planner-workspace">
  ${pageHeading("Senaryolarım", "Dersleri taşı, notları değiştir, ortalamana etkisini gör.", `<button class="button secondary" data-page="transcript">${icon("book")} Gerçek notlarım</button><button class="button secondary" data-action="planner-retake">${icon("repeat")} Ders tekrarı</button>`)}
  <div class="planner-scenario-bar"><div class="planner-scenario-select">${scenarioSelect()}<button class="icon-button" data-action="rename-scenario" aria-label="Senaryoyu yeniden adlandır">${icon("edit")}</button></div><div class="planner-scenario-actions"><button class="button small secondary" data-action="new-scenario">${icon("plus")} Yeni</button><button class="button small secondary" data-action="duplicate-scenario">${icon("copy")} Kopyala</button><button class="button small secondary" data-action="compare">Karşılaştır</button><button class="icon-button danger-link" data-action="delete-scenario" aria-label="Senaryoyu sil" title="Senaryoyu sil" ${state.scenarios.length === 1 ? "disabled" : ""}>${icon("close")}</button></div></div>
  <section class="planner-summary" aria-label="Senaryo sonuçları"><div><span>Şu anki GNO</span><strong>${num(a.gpa)}</strong><small>${num(a.gpaCredits, 0)} kredi notu girildi</small></div><div class="planner-projection"><span>Senaryo sonu GNO</span><div><strong>${num(p.gpa)}</strong>${a.gpa !== null && p.gpa !== null ? `<b>${sign(p.gpa - a.gpa)}</b>` : ""}</div><small>${p.remainingUnplanned ? `${p.remainingUnplanned} gerekliliğe daha not gerekli` : "Tüm anadal gereklilikleri planlandı"}</small></div><div><span>Planlanan anadal dersi</span><strong>${p.plannedCount}<small> / ${num(p.plannedCredits, 0)} kredi</small></strong><small>${state.profile.currentSemester}–${state.profile.graduationSemester}. dönem</small></div>${state.profile.minorEnabled ? `<div><span>Yandal tahmini</span><strong>${num(predicted("minor").gpa)}</strong><small>Anadaldan ayrı hesaplanır</small></div>` : ""}</section>
  ${!hasData() ? `<div class="planner-start"><span>Toplam ortalaman için önce aldığın derslerin gerçek notlarını ekle.</span><button class="subtle-link" data-page="transcript">Notları gir ${icon("arrow")}</button>${!p.plannedCount ? '<button class="subtle-link" data-action="example">Örnekle dene</button>' : ""}</div>` : ""}
  <div class="planner-tools"><div class="segmented" aria-label="Görünüm"><button class="${ui.planView !== "list" ? "active" : ""}" data-action="board-view" aria-pressed="${ui.planView !== "list"}">${icon("grid")} Dönemler</button><button class="${ui.planView === "list" ? "active" : ""}" data-action="list-view" aria-pressed="${ui.planView === "list"}">${icon("book")} Liste</button></div><div class="planner-fill-actions"><button class="button primary" data-action="random-fill">${icon("spark")} Notları doldur</button></div></div>
  ${filters(false)}
  ${uncertain || minorUncertain ? `<details class="planner-uncertainty"><summary>Not olasılıklarına göre sonuç aralığı</summary>${uncertain ? probabilityPanel("major") : ""}${minorUncertain ? probabilityPanel("minor") : ""}</details>` : ""}
  ${
    ui.planView !== "list"
      ? planBoard()
      : `<div class="panel table-panel"><div class="table-scroll"><table class="course-table scenario-table"><thead><tr><th scope="col">Ders</th><th scope="col">Şu an</th><th scope="col">Tahminin</th><th scope="col">Planlanan dönem</th><th scope="col"><span class="sr-only">Olasılıklar</span></th></tr></thead><tbody>${
          rows
            .map((c) => {
              const e = entry(c.id),
                g = state.transcript[c.id] || "";
              return `<tr class="${e.grade || e.distribution ? "planned-row" : ""}"><td><div class="course-title"><span class="course-code">${esc(c.code)}</span><span class="row-hint">${c.credits} kr.${c.major && c.minor ? " · ortak" : ""}</span></div><div class="course-name">${esc(c.name)}</div></td><td><span class="actual-grade">${g || "—"}</span>${isPassed(g) && Boolean(e.grade || e.distribution) ? '<span class="row-hint">Tekrar</span>' : ""}</td><td>${e.distribution ? `<button class="probability-chip" data-action="probability" data-id="${esc(c.id)}">${icon("spark")} Olasılıklı</button>` : gradeSelect(c.id, e.grade || "", "plan", c.credits === 0)}</td><td><select id="term-${esc(c.id)}" class="term-select" data-term="${esc(c.id)}" aria-label="${esc(c.code)} planlanan dönem">${Array.from({ length: state.profile.graduationSemester }, (_, i) => `<option value="${i + 1}" ${e.term === i + 1 ? "selected" : ""}>${i + 1}. dönem</option>`).join("")}</select></td><td><button class="icon-button" data-action="${c.credits ? "probability" : "clear-plan"}" data-id="${esc(c.id)}" title="${c.credits ? "Not olasılıklarını dene" : "Tahmini temizle"}" aria-label="${esc(c.code)} ${c.credits ? "not olasılıkları" : "tahminini temizle"}">${icon(c.credits ? "spark" : "close")}</button></td></tr>`;
            })
            .join("") ||
          '<tr><td colspan="5" class="empty-cell">Bu filtrelerle eşleşen ders yok.</td></tr>'
        }</tbody></table></div><div class="table-footer"><span>Tahmini kaldırmak için “Seç…” seç.</span><span>${icon("spark")} ile AA / BA / BB ihtimallerini kendin belirle.</span></div></div>`
  }<div class="inline-note">${icon("info")} Dönemler bir planlama sırasıdır; dersin açılacağını veya ön koşullarının sağlandığını garanti etmez. Seçmeli yerlerinin gerçek ders ve kredilerini Transkriptim’den düzenle.</div></div>`;
}
function plannerCourseDialog(id, isActual) {
  const c = allCourses().find((course) => course.id === id);
  if (!c) return;
  openDialog(
    esc(c.code),
    `<p class="planner-dialog-description">${esc(c.name)} · ${c.credits} yerel kredi${isActual ? ` · Gerçek not: ${state.transcript[id]}` : ""}</p><div class="planner-detail-actions">${!isActual && c.credits ? `<button class="data-action" data-action="probability" data-id="${esc(id)}">${icon("chart")}<strong>Not olasılıkları</strong><span>AA, BA, BB gibi sonuçlara yüzde ver.</span></button><button class="data-action" data-action="planner-exam" data-id="${esc(id)}">${icon("book")}<strong>Sınav hesabı</strong><span>Vize ve final notlarından ders puanını hesapla.</span></button>` : ""}${isActual && c.credits && Object.hasOwn(gradePoints, state.transcript[id]) ? `<button class="data-action" data-action="planner-retake" data-id="${esc(id)}">${icon("repeat")}<strong>Tekrarını dene</strong><span>Yeni notun ortalamaya etkisini gör.</span></button>` : ""}<button class="data-action" data-action="edit-course" data-id="${esc(id)}">${icon("edit")}<strong>Dersi düzenle</strong><span>Ders seçimi, kredi ve program bilgileri.</span></button></div>${!isActual ? `<div class="dialog-actions"><button class="button secondary" data-action="planner-clear" data-id="${esc(id)}">Tahmini temizle</button><button class="button primary" data-action="close-dialog">Tamam</button></div>` : ""}`,
  );
}
function plannerRetakeDialog(id = ui.retakeId) {
  const courses = visibleCourses().filter(
    (c) => c.credits > 0 && Object.hasOwn(gradePoints, state.transcript[c.id]),
  );
  if (!courses.length) {
    openDialog(
      "Ders tekrarı",
      `<p>Önce tamamladığın derslerin gerçek notlarını gir. Sonra aynı ders için farklı bir not deneyebilirsin.</p><div class="dialog-actions"><button class="button primary" data-page="transcript">Gerçek notları gir ${icon("arrow")}</button></div>`,
    );
    return;
  }
  const selected = courses.find((c) => c.id === id) || courses[0];
  openDialog(
    "Ders tekrarı",
    `<form id="planner-retake-form"><label for="planner-retake-course">Tekrar alacağın ders</label><select id="planner-retake-course">${courses.map((c) => `<option value="${esc(c.id)}" ${c.id === selected.id ? "selected" : ""}>${esc(c.code)} · ${state.transcript[c.id]} · ${c.credits} kredi</option>`).join("")}</select><div class="form-grid"><label for="planner-retake-grade">Yeni not<select id="planner-retake-grade">${letterGrades.map((g) => `<option value="${g}" ${g === ui.retakeGrade ? "selected" : ""}>${g}</option>`).join("")}</select></label><label for="planner-retake-term">Tekrar dönemi<select id="planner-retake-term"></select></label></div><div id="planner-retake-preview" aria-live="polite"></div><p class="small muted">Yeni not eski notun yerine geçer; daha düşük bir not ortalamayı düşürebilir. Gerçek transkriptin değişmez.</p><div class="dialog-actions"><button class="button secondary" type="button" data-action="close-dialog">Vazgeç</button><button class="button primary" type="submit">Senaryoya ekle ${icon("plus")}</button></div></form>`,
  );
  const updateTerms = () => {
    const c = courses.find((c) => c.id === $("#planner-retake-course").value);
    const first = Math.max(
      state.profile.currentSemester,
      (courseSemester(c) || 1) + 1,
    );
    const plannedTerm = plannedEntry(c.id).term;
    const last = Math.min(
      12,
      Math.max(state.profile.graduationSemester, plannedTerm, first),
    );
    $("#planner-retake-term").innerHTML = Array.from(
      { length: last - first + 1 },
      (_, i) => first + i,
    )
      .map(
        (term) =>
          `<option value="${term}" ${term === plannedTerm ? "selected" : ""}>${term}. dönem</option>`,
      )
      .join("");
  };
  const preview = () => {
    const c = courses.find((c) => c.id === $("#planner-retake-course").value);
    const g = $("#planner-retake-grade").value;
    const noTerm = !$("#planner-retake-term").value;
    $("#planner-retake-form button[type=submit]").disabled = noTerm;
    if (noTerm) {
      $("#planner-retake-preview").innerHTML =
        '<p class="inline-note">Bu dersin ardından, 12 dönemlik plan sınırı içinde bir tekrar dönemi bulunmuyor.</p>';
      return;
    }
    const impact = retakeImpact(
      allCourses(),
      state.transcript,
      c.id,
      g,
      activeScenario(),
      c.major ? "major" : "minor",
    );
    const outsideWindow =
      isPassed(state.transcript[c.id]) &&
      Number($("#planner-retake-term").value) > (courseSemester(c) || 1) + 4;
    $("#planner-retake-preview").innerHTML =
      `<div class="planner-retake-results"><div><span>Bugünkü ${c.major ? "anadal" : "yandal"} ortalaman</span><strong>${num(impact.currentGpa)} → ${num(impact.immediateGpa)}</strong><b>${sign(impact.immediateDelta)}</b></div><div><span>Diğer planladığın derslerle</span><strong>${num(impact.projectedBaselineGpa)} → ${num(impact.projectedGpa)}</strong><b>${sign(impact.projectedDelta)}</b></div></div><p class="small muted">${predicted(c.major ? "major" : "minor").remainingUnplanned ? "Tam mezuniyet etkisi için kalan derslerini de planla." : "Senaryondaki diğer notlar sabit tutulur."}</p>${outsideWindow ? '<div class="inline-note">Bu dönem, geçilen dersler için dört dönemlik tekrar süresinin dışında. Kayıt uygunluğunu bölümden doğrula.</div>' : '<p class="small muted">Tekrar süresi ve kayıt uygunluğu danışman onayına bağlıdır.</p>'}`;
  };
  updateTerms();
  preview();
  $("#planner-retake-form").addEventListener("change", (event) => {
    if (event.target.id === "planner-retake-course") updateTerms();
    preview();
  });
  $("#planner-retake-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const courseId = $("#planner-retake-course").value;
    const grade = $("#planner-retake-grade").value;
    const term = Number($("#planner-retake-term").value);
    closeDialog();
    mutate(() => {
      const e = { ...plannedEntry(courseId), grade, term };
      delete e.distribution;
      activeScenario().courses[courseId] = e;
      ui.retakeId = courseId;
      ui.retakeGrade = grade;
    }, "Ders tekrarı senaryona eklendi.");
  });
}
function probabilityPanel(program = "major") {
  const target =
    program === "minor" ? minorRules.minimumGpa : state.profile.target;
  const forecast = probabilityForecast(
    allCourses(),
    state.transcript,
    activeScenario(),
    target,
    program,
  );
  return `<section class="probability-summary panel"><div><span class="eyebrow">${program === "minor" ? "YANDAL" : "ANADAL"} OLASILIK HESABI</span><h3>Beklenen sonuçlar</h3><p>Hedefin ${num(target)} · ${forecast.uncertainCount} belirsiz ders · ${forecast.samples.toLocaleString("tr-TR")} örnek hesap</p></div><div><span>Beklenen GNO</span><strong>${num(forecast.expectedGpa)}</strong></div><div><span>Ortadaki %80 aralık</span><strong>${num(forecast.p10)} – ${num(forecast.p90)}</strong></div><div><span>Hedefe ulaşma tahmini</span><strong>${forecast.chance === null ? "—" : "%" + num(forecast.chance * 100, 1)}</strong></div><p class="probability-caveat">Seçili derslerle ve bağımsız not varsayımıyla hesaplanır. Verdiğin olasılıklar bir başarı tahmini veya garanti değildir.</p></section>`;
}
function retakesPage() {
  const eligible = visibleCourses().filter(
    (c) => c.credits > 0 && Object.hasOwn(gradePoints, state.transcript[c.id]),
  );
  if (!eligible.some((c) => c.id === ui.retakeId))
    ui.retakeId = eligible[0]?.id || "";
  const c = eligible.find((c) => c.id === ui.retakeId),
    impact = c
      ? retakeImpact(
          allCourses(),
          state.transcript,
          c.id,
          ui.retakeGrade,
          activeScenario(),
          c.major ? "major" : "minor",
        )
      : null;
  return `${pageHeading("Ders tekrarı", "Yeni notun bugünkü ve plan sonu ortalamana etkisi.")}
  ${
    !c
      ? `<section class="panel empty-state"><div class="empty-icon">${icon("repeat")}</div><h2>Önce karşılaştıracak bir not lazım.</h2><p>Transkriptim’den PHYS 105 gibi tamamladığın bir dersin notunu gir.<br>Sonra burada yeni bir notla karşılaştırabilirsin.</p><button class="button primary" data-page="transcript">Notlarımı gir ${icon("arrow")}</button><button class="subtle-link" data-action="example">Örnek verilerle dene</button></section>`
      : `<div class="retake-layout"><section class="panel retake-controls"><label for="retake-course">Hangi dersi tekrar almayı düşünüyorsun?</label><select id="retake-course" class="large-select">${eligible.map((x) => `<option value="${esc(x.id)}" ${x.id === c.id ? "selected" : ""}>${esc(x.code)} · ${esc(x.name)}</option>`).join("")}</select><div class="retake-grade-pair"><div><span>Şu anki notun</span><strong>${state.transcript[c.id]}</strong><small>${c.credits} kredi</small></div>${icon("arrow")}<div><label for="retake-grade">Yeni notun</label><select id="retake-grade" class="large-grade">${letterGrades.map((g) => `<option ${g === ui.retakeGrade ? "selected" : ""}>${g}</option>`).join("")}</select></div></div><div class="point-gain">${icon("spark")} Toplam ağırlıklı puan farkı: <strong>${sign(impact.pointGain)}</strong></div><button class="button primary full-width" data-action="apply-retake">Bu tekrarı senaryoma ekle ${icon("arrow")}</button><p class="small muted">${esc(activeScenario().name)} senaryosuna eklenir. Gerçek notun değişmez.</p>${isPassed(state.transcript[c.id]) ? `<div class="inline-note">${icon("info")} Kayıtlı dönemine göre, geçilen bu dersi tekrar etmek için dört dönemlik pencere ${Math.min(99, (courseSemester(c) || 1) + 4)}. dönemde biter. Planlanan tekrarın ${plannedEntry(c.id).term}. dönemde. ${plannedEntry(c.id).term > (courseSemester(c) || 1) + 4 ? "Bu plan süre dışında; kayıt uygunluğunu bölümden doğrula." : "Kayıtlı ilk ders dönemin ve danışman onayın doğru olmalı."}</div>` : ""}</section><section class="panel retake-answer"><span class="pill sage">${c.major ? "ANADAL" : "YANDAL"} ETKİSİ</span><h2>Ortalamaya etkisi</h2><div class="impact-row"><div><strong>Bugünkü ortalamanda</strong><span>${num(impact.currentGpa)} → ${num(impact.immediateGpa)}</span></div><b>${sign(impact.immediateDelta)}</b></div><div class="impact-row"><div><strong>Diğer planladığın derslerle</strong><span>${num(impact.projectedBaselineGpa)} → ${num(impact.projectedGpa)}</span></div><b>${sign(impact.projectedDelta)}</b></div><p>${predicted(c.major ? "major" : "minor").remainingUnplanned ? `Mezuniyet etkisini görmek için kalan derslerini de planla. Şu anda ${esc(activeScenario().name)} içindeki diğer tahminler sabit tutuluyor.` : "Senaryondaki diğer not tahminleri sabit tutuluyor."}</p></section></div>
  <section class="panel retake-ranking"><div class="panel-heading"><div><h2>Hangi ders daha çok fark yaratır?</h2></div><span class="pill neutral">Hepsi ${ui.retakeGrade} olursa · tek tek</span></div><div class="ranking-list">${eligible
    .map((x) => ({
      course: x,
      result: retakeImpact(
        allCourses(),
        state.transcript,
        x.id,
        ui.retakeGrade,
        activeScenario(),
        x.major ? "major" : "minor",
      ),
    }))
    .sort((a, b) => b.result.projectedDelta - a.result.projectedDelta)
    .slice(0, 8)
    .map(
      ({ course: x, result: r }, i) =>
        `<button class="ranking-row ${x.id === c.id ? "selected" : ""}" data-action="select-retake" data-id="${esc(x.id)}"><span class="ranking-index">${String(i + 1).padStart(2, "0")}</span><span class="ranking-course"><b>${esc(x.code)}</b><small>${state.transcript[x.id]} → ${ui.retakeGrade} · ${x.credits} kredi ${x.major ? "" : "· yandal"}</small></span><span class="ranking-track"><i style="width:${Math.max(0, Math.min(100, r.projectedDelta * 500))}%"></i></span><strong>${sign(r.projectedDelta)}</strong>${icon("arrow")}</button>`,
    )
    .join("")}</div></section>`
  }
  <div class="inline-note">${icon("info")} Tekrarda son not geçerlidir; daha düşük gelirse ortalama da düşebilir. Geçilen derslerin tekrarında güncel yönetmelik sonraki dört dönem sınırı koyar. Geçilen derslerde tekrar süresi, kayıt yükü ve danışman onayı ayrıca kontrol edilmelidir. Bu ekran yalnızca sayısal etkiyi gösterir.</div>`;
}
function defaultTerm(course) {
  if (state.transcript[course.id])
    return Math.max(
      state.profile.currentSemester,
      (courseSemester(course) || 1) + 1,
    );
  return Math.max(
    state.profile.currentSemester,
    courseSemester(course) || state.profile.currentSemester,
  );
}
function plannedEntry(id) {
  const c = allCourses().find((c) => c.id === id);
  return activeScenario().courses[id] || { grade: "", term: defaultTerm(c) };
}
function plannerCourseLabel(course) {
  const code = course.code;
  if (/^MINOR_ELECTIVE_[1-4]$/.test(code))
    return `Yandal seçmeli ${code.at(-1)}`;
  if (/^TE[1-5]$/.test(code)) return `Teknik seçmeli ${code.at(-1)}`;
  if (/^NTE[1-2]$/.test(code)) return `Alan dışı seçmeli ${code.at(-1)}`;
  return { FREE: "Serbest seçmeli", REST: "Kısıtlı seçmeli" }[code] || code;
}
function planBoard() {
  const courses = visibleCourses().map((c) => ({
    ...c,
    semester: courseSemester(c),
  }));
  const forecast = semesterForecast(
    courses,
    state.transcript,
    activeScenario(),
    state.profile,
  );
  const first = ui.showHistory ? 1 : state.profile.currentSemester;
  const last = Math.max(
    state.profile.graduationSemester,
    ...courses.map((c) => courseSemester(c) || state.profile.currentSemester),
    ...Object.values(activeScenario().courses).map((e) => e.term),
  );
  return `<div class="planner-board-caption"><span>Dersleri dönemler arasında sürükle.</span><label class="checkbox-label"><input id="show-history" type="checkbox" ${ui.showHistory ? "checked" : ""}> Geçmiş dönemler</label></div><div class="semester-board">${Array.from(
    { length: last - first + 1 },
    (_, i) => i + first,
  )
    .map((term) => {
      const f = forecast.find((t) => t.term === term),
        cards = [];
      for (const c of courses) {
        const e = activeScenario().courses[c.id],
          g = state.transcript[c.id],
          hasPlan = e && Boolean(e.grade || e.distribution || e.term);
        if (g && (courseSemester(c) || state.profile.currentSemester) === term)
          cards.push({ c, actual: true, g });
        if (hasPlan && e.term === term && (!g || e.grade || e.distribution))
          cards.push({ c, actual: false, g: e.grade || "" });
        else if (
          !g &&
          !hasPlan &&
          (courseSemester(c) || state.profile.currentSemester) === term
        )
          cards.push({ c, actual: false, g: "" });
      }
      const creditLoad = cards.reduce((n, x) => n + x.c.credits, 0);
      const shownCards = cards.filter(({ c }) => {
        if (ui.program !== "all" && !c[ui.program]) return false;
        if (
          ui.search &&
          !`${c.code} ${c.name}`
            .toLocaleLowerCase("tr")
            .includes(ui.search.toLocaleLowerCase("tr"))
        )
          return false;
        const e = activeScenario().courses[c.id];
        if (ui.status === "remaining") return !e?.grade && !e?.distribution;
        if (ui.status === "graded") return Boolean(e?.grade || e?.distribution);
        if (ui.status === "failed")
          return (
            Boolean(state.transcript[c.id]) && !isPassed(state.transcript[c.id])
          );
        return true;
      });
      return `<section class="semester-card ${term === state.profile.currentSemester ? "current-semester" : ""}" data-drop-term="${term}" aria-label="${term}. dönem"><div class="semester-header"><div><span class="semester-year">${Math.ceil(term / 2)}. yıl / ${term % 2 ? "Güz" : "Bahar"}</span><h3>${term}. dönem ${term === state.profile.currentSemester ? '<span class="mini-badge">Bu dönem</span>' : ""}</h3></div><span class="semester-load">${cards.length} ders<br>${creditLoad} kredi</span></div><div class="semester-metrics"><span>Dönem <strong>${num(f?.major.semesterGpa)}</strong></span><span>GNO <strong>${num(f?.major.cumulativeGpa)}</strong></span>${state.profile.minorEnabled ? `<span>Yandal <strong>${num(f?.minor.cumulativeGpa)}</strong></span>` : ""}</div><div class="semester-course-list">${
        shownCards
          .map(
            ({ c, actual: isActual, g }) =>
              `<article class="semester-course ${isActual ? "recorded-course" : ""}" draggable="true" data-drag-course="${esc(c.id)}" data-drag-actual="${isActual}" data-original-term="${term}"><div class="planner-course-row"><span class="drag-handle" aria-hidden="true">⠿</span><div class="planner-course-info"><button class="planner-course-code" data-action="planner-course" data-id="${esc(c.id)}" data-actual="${isActual}">${esc(plannerCourseLabel(c))}</button><span class="planner-course-meta">${c.credits ? `${c.credits} kr.` : "Kredisiz"}${isActual ? " · Gerçek not" : state.transcript[c.id] ? ` · Tekrar (${state.transcript[c.id]})` : c.minor && !c.major ? " · Yandal" : ""}</span><p>${esc(c.name)}</p></div><div class="planner-course-grade">${
                isActual
                  ? gradeSelect(c.id, g, "actual", c.credits === 0)
                  : entry(c.id).distribution
                    ? `<button class="probability-chip" data-action="probability" data-id="${esc(c.id)}">Olasılık<br><strong>${num(
                        Object.entries(entry(c.id).distribution).reduce(
                          (sum, [grade, chance]) =>
                            sum + (gradePoints[grade] * chance) / 100,
                          0,
                        ),
                        2,
                      )}</strong></button>`
                    : gradeSelect(c.id, g, "plan", c.credits === 0)
              }</div></div><div class="planner-course-footer"><button class="subtle-link" data-action="planner-course" data-id="${esc(c.id)}" data-actual="${isActual}">Detaylar ${icon("arrow")}</button><label class="move-label"><span class="sr-only">${esc(c.code)} ${isActual ? "gerçek" : "planlanan"} dersini taşı</span><select data-move-course="${esc(c.id)}" data-move-actual="${isActual}" aria-label="${esc(c.code)} ${isActual ? "gerçek" : "planlanan"} dönem">${Array.from({ length: last }, (_, j) => `<option value="${j + 1}" ${j + 1 === term ? "selected" : ""}>${j + 1}. döneme</option>`).join("")}</select></label></div></article>`,
          )
          .join("") ||
        `<div class="semester-empty">${cards.length ? "Filtreye uygun ders yok." : "Dersleri buraya sürükle"}</div>`
      }</div></section>`;
    })
    .join("")}</div>`;
}
function examsPage() {
  const courses = visibleCourses().filter((c) => c.credits > 0);
  if (!courses.some((c) => c.id === ui.examId))
    ui.examId =
      courses.find((c) => !state.transcript[c.id])?.id || courses[0]?.id;
  const c = courses.find((c) => c.id === ui.examId),
    e = entry(c.id);
  const assessments = e.assessments || [
    { name: "Vize", weight: 30, score: null },
    { name: "Ödev / proje", weight: 20, score: null },
    { name: "Final", weight: 50, score: null },
  ];
  const target = e.examTarget ?? 80;
  return `${pageHeading("Sınav hesabı", "Dersin gerçek ağırlıklarını gir. Boş notlar, henüz alınmamış notlardır.")}
  <div class="exam-layout"><section class="panel exam-form"><label for="exam-course">Hangi ders için hesaplayalım?</label><select id="exam-course" class="large-select">${courses.map((x) => `<option value="${esc(x.id)}" ${x.id === c.id ? "selected" : ""}>${esc(x.code)} · ${esc(x.name)}</option>`).join("")}</select><div class="exam-table-heading"><span>Değerlendirme</span><span>Ağırlık (%)</span><span>Not (0–100)</span><span></span></div><div id="assessment-rows">${assessments.map((x, i) => `<div class="assessment-row"><input type="text" data-exam-index="${i}" data-exam-field="name" value="${esc(x.name)}" aria-label="${i + 1}. değerlendirme adı" maxlength="80"><input type="number" data-exam-index="${i}" data-exam-field="weight" min="0" max="100" step="1" value="${x.weight}" aria-label="${esc(x.name)} ağırlığı"><input type="number" data-exam-index="${i}" data-exam-field="score" min="0" max="100" step=".1" value="${x.score ?? ""}" placeholder="Henüz yok" aria-label="${esc(x.name)} notu"><button class="icon-button" data-action="remove-exam" data-index="${i}" aria-label="${esc(x.name)} değerlendirmesini kaldır">${icon("close")}</button></div>`).join("")}</div><button class="button secondary small" data-action="add-exam">${icon("plus")} Değerlendirme ekle</button><div class="form-divider"></div><label for="exam-target">Ders sonunda hedeflediğin sayısal not</label><div class="number-suffix"><input type="number" id="exam-target" min="0" max="100" step=".1" value="${target}"><span>/ 100</span></div><p class="small muted">Ağırlıkları dersin izlencesine göre düzenle. Boş notlar için gereken ağırlıklı ortalama hesaplanır.</p></section><section id="exam-result" class="panel exam-result">${examResult(assessments, target)}</section></div>
  <section class="panel letter-link"><div>${icon("branch")}<div><h3>Senaryoya harf notu ekle</h3><p>Sayısal puanın harf karşılığını dersin değerlendirme kuralına göre kendin seç.</p></div></div><div class="button-row">${gradeSelect(c.id, e.grade || "", "plan")}<button class="button secondary" data-page="scenarios">Senaryomu gör ${icon("arrow")}</button></div></section><div class="inline-note">${icon("info")} “80 = BA” gibi sabit bir eşik kullanılmaz. Bağıl değerlendirme ve harf sınırları derse göre değişebilir.</div>`;
}
function examResult(assessments, target) {
  const result = weightedExams(assessments, target);
  if (!result.valid)
    return `<h2>Ağırlıkları kontrol et</h2><div class="inline-note error-note">${esc(result.error)}</div><p>Ağırlıklar toplamı %100, her not 0–100 arasında olmalı.</p>`;
  const secured =
    result.requiredAverage !== null && result.requiredAverage <= 0;
  return `<span class="eyebrow">HEDEFİN ${num(target, 1)} / 100</span><h2>${result.remainingWeight > 0 ? "Kalan değerlendirmelerde<br>gereken ortalama" : "Dersin ağırlıklı<br>not ortalaması"}</h2><div class="exam-big-number">${num(result.remainingWeight > 0 ? Math.max(0, result.requiredAverage) : result.weightedScore, 1)}<span>/ 100</span></div><div class="exam-meter"><span style="width:${Math.min(100, Math.max(0, result.weightedScore))}%"></span></div><div class="exam-breakdown"><span>Şimdiye kadar katkı <b>${num(result.weightedScore, 1)} puan</b></span><span>Notu girilmemiş ağırlık <b>%${num(result.remainingWeight, 0)}</b></span></div><div class="exam-verdict">${result.remainingWeight === 0 ? (result.weightedScore >= target ? "Hedefin karşılanıyor." : "Bu notlarla hedefin altında kalıyorsun.") : result.requiredAverage > 100 ? "Bu hedef, kalan değerlendirmelerde 100’ün üstünde gerektiriyor. Hedefi veya varsayımlarını değiştir." : secured ? "Girdiğin puanlarla hedefin karşılanıyor. Dersin özel geçme koşullarını ayrıca kontrol et." : "Bu, boş bıraktığın değerlendirmelerin ağırlıklı ortalaması. Bir tek final boşsa, gereken final notun bu."}</div>`;
}
function minorAudit() {
  const courses = allCourses(),
    electives = courses.filter((c) => c.kind === "minor-elective" && c.minor);
  const selected = electives.filter(
    (c) =>
      state.courseOverrides[c.id]?.code &&
      c.code.replace(/\s/g, "").toUpperCase() !==
        baseCourses
          .find((b) => b.id === c.id)
          ?.code.replace(/\s/g, "")
          .toUpperCase(),
  );
  const unlisted = selected.filter(
    (c) =>
      !minorOptions.some(
        (o) =>
          o.code.replace(/\s/g, "").toUpperCase() ===
            c.code.replace(/\s/g, "").toUpperCase() && !o.majorRequired,
      ),
  );
  const majorCodes = new Set(
    courses
      .filter((c) => c.major)
      .map((c) => c.code.replace(/\s/g, "").toUpperCase()),
  );
  const duplicates = selected.filter(
    (c, i) =>
      selected.findIndex(
        (x) =>
          x.code.replace(/\s/g, "").toUpperCase() ===
          c.code.replace(/\s/g, "").toUpperCase(),
      ) !== i,
  );
  const overlaps = selected.filter((c) =>
    majorCodes.has(c.code.replace(/\s/g, "").toUpperCase()),
  );
  const upper = selected.filter((c) =>
    /^[A-Z]+4\d{2}$/.test(c.code.replace(/\s/g, "").toUpperCase()),
  ).length;
  return { electives, selected, upper, duplicates, overlaps, unlisted };
}
function minorPage() {
  const a = actual("minor"),
    p = predicted("minor"),
    audit = minorAudit(),
    courses = allCourses().filter((c) => c.minor);
  const checks = [
    [
      !audit.unlisted.length && audit.selected.length >= 4,
      "Yayımlanmış yandal seçmeli listesi",
      audit.unlisted.length
        ? `${audit.unlisted.map((c) => c.code).join(", ")} için resmî uygunluk doğrulanamadı`
        : "Ders seçeneklerini resmî listeyle karşılaştır",
    ],
    [
      audit.selected.length >= 4,
      "4 ayrı yandal seçmelisi",
      `${audit.selected.length} / 4 ders seçildi`,
    ],
    [
      audit.upper >= 2,
      "En az 2 adet 4xx seçmeli",
      `${audit.upper} / 2 üst sınıf dersi`,
    ],
    [
      audit.selected.reduce((s, c) => s + c.credits, 0) >= 12,
      "En az 12 ek kredi",
      `${audit.selected.reduce((s, c) => s + c.credits, 0)} / 12 seçmeli kredisi`,
    ],
    [
      !audit.overlaps.length &&
        !audit.duplicates.length &&
        audit.selected.length >= 4,
      "Anadaldan ayrı, tekrarsız seçmeliler",
      audit.overlaps.length
        ? `${audit.overlaps.map((c) => c.code).join(", ")} anadal ile çakışıyor`
        : audit.duplicates.length
          ? "Aynı seçmeli birden fazla kez seçilmiş"
          : "Seçimlerini onaylı saydırmayla karşılaştır",
    ],
  ];
  return `${pageHeading("Mekatronik yandal", "Yandal notlarını ve kalan gerekliliklerini anadaldan ayrı takip et.")}
  <div class="stats-grid minor-stats">${statCard("Gerçek yandal GNO", num(a.gpa), `${num(a.gpaCredits, 0)} kredilik girilmiş not`, icon("chip"))}${statCard("Senaryoyla yandal GNO", num(p.gpa), `${p.plannedCount} ders tahmini`, icon("branch"), "tinted")}${statCard("Kalan yandal kredisi", num(a.remainingCredits, 0), "Ortak saydırma varsayımıyla", icon("circle"))}${statCard("Seçmeli seçimi", `${audit.selected.length}<span class="stat-denom"> / 4</span>`, "En az iki ders 4xx olmalı", icon("book"))}</div>
  <div class="minor-layout"><section class="panel"><h2>Yandal gereklilikleri</h2><div class="checklist">${checks.map(([ok, title, detail]) => `<div class="checklist-item"><span class="check-indicator ${ok ? "done" : ""}">${icon(ok ? "check" : "circle")}</span><div><strong>${title}</strong><p>${detail}</p></div></div>`).join("")}</div><div class="inline-note">${icon("info")} ME 205 ve CENG 240 şablonda ortak sayılıyor. Danışman onayını ve yandal transkriptini kontrol et; gerekirse ders düzenleyicisinden değiştir. EE 209, EE 281 yerine otomatik sayılmaz.</div></section><section class="panel minor-explainer"><h2>Ayrı GPA hesabı</h2><p>Ortak sayılan ders, anadalda bir kez; yandalda bir kez hesaplanır. Yalnızca yandal için alınan ders anadal GNO’sunu değiştirmez.</p><p>Şablon: 5 zorunlu grup + anadal dışında 4 seçmeli. Derslerin gerçek kredileri ve onaylı saydırmaları toplamı değiştirebilir.</p><a class="button secondary" href="https://me.metu.edu.tr/system/files/mechaminor_2_0.pdf" target="_blank" rel="noreferrer">Resmî ders listesini aç ${icon("arrow")}</a></section></div>
  <section class="panel table-panel"><div class="table-top"><h3>Yandal derslerin</h3><span class="muted small">${courses.length} ders / gereklilik</span></div><div class="table-scroll"><table class="course-table"><thead><tr><th>Ders</th><th>Kredi</th><th>Gerçek not</th><th></th></tr></thead><tbody>${courses.map((c) => `<tr><td><div class="course-title"><span class="course-code">${esc(c.code)}</span>${c.major ? '<span class="mini-badge">ORTAK · ONAY GEREKİR</span>' : ""}</div><div class="course-name">${esc(c.name)}</div></td><td>${c.credits}</td><td>${gradeSelect(c.id, state.transcript[c.id] || "", "actual", c.credits === 0)}</td><td><button class="button small secondary" data-action="edit-course" data-id="${esc(c.id)}">${c.placeholder && !state.courseOverrides[c.id]?.code ? "Ders seç" : "Düzenle"}</button></td></tr>`).join("")}</tbody></table></div></section><div class="inline-note">${icon("info")} Bu bir gereklilik planıdır. Yer tutucu seçmeliler, ön koşullar, ders açılması, programda kalma koşulları ve resmî mezuniyet onayı ayrıca doğrulanır.</div>`;
}
function openDialog(title, body, wide = false) {
  const dialog = $("#dialog");
  if (dialog.open) closeDialog();
  dialog.className = wide ? "wide-dialog" : "";
  dialog.innerHTML = `<div class="dialog-heading"><div><h2 id="dialog-title">${title}</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Pencereyi kapat">${icon("close")}</button></div><div class="dialog-content">${body}</div>`;
  dialog.showModal();
}
function closeDialog() {
  const dialog = $("#dialog");
  if (dialog.open) dialog.close();
}
function confirmDialog(title, description, button, callback) {
  openDialog(
    title,
    `<p>${description}</p><div class="dialog-actions"><button class="button secondary" data-action="close-dialog">Vazgeç</button><button class="button primary" id="confirm-action">${button}</button></div>`,
  );
  $("#confirm-action").addEventListener(
    "click",
    () => {
      closeDialog();
      callback();
    },
    { once: true },
  );
}
function nameDialog(duplicate = false, rename = false) {
  openDialog(
    rename
      ? "Senaryona bir isim ver."
      : duplicate
        ? "Bu planın bir kopyası."
        : "Yeni senaryo",
    `<form id="name-form"><label for="scenario-name">Senaryo adı</label><input id="scenario-name" type="text" maxlength="80" required value="${rename ? esc(activeScenario().name) : duplicate ? esc(activeScenario().name + " · alternatif") : ""}" placeholder="Örn. PHYS 105 tekrarı + sakin bir 5. yıl"><p class="small muted">${rename ? "" : "Her senaryo aynı gerçek notları kullanır. Tahminleri ve dönem planı ayrıdır."}</p><div class="dialog-actions"><button type="button" class="button secondary" data-action="close-dialog">Vazgeç</button><button type="submit" class="button primary">${rename ? "Adı kaydet" : "Oluştur"} ${icon("arrow")}</button></div></form>`,
  );
  $("#name-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#scenario-name").value.trim();
    if (!name) return;
    closeDialog();
    mutate(() => {
      if (rename) activeScenario().name = name;
      else {
        const id = newId("plan");
        state.scenarios.push({
          id,
          name,
          courses: duplicate ? structuredClone(activeScenario().courses) : {},
        });
        state.activeScenarioId = id;
      }
    }, "Senaryo hazır.");
  });
}
function compareDialog() {
  openDialog(
    "İhtimalleri yan yana koy.",
    `<p>Aynı transkript, farklı gelecekler. Boş bırakılan dersler bu karşılaştırmaya katılmaz.</p><div class="table-scroll"><table class="comparison-table"><thead><tr><th>Senaryo</th><th>Anadal GNO</th><th>Fark</th><th>Yandal GNO</th><th>Eksik plan</th></tr></thead><tbody>${state.scenarios
      .map((s) => {
        const p = project(allCourses(), state.transcript, s);
        const m = project(allCourses(), state.transcript, s, "minor");
        return `<tr><td><button class="subtle-link" data-action="select-scenario" data-id="${esc(s.id)}">${esc(s.name)}</button></td><td><strong>${num(p.gpa)}</strong></td><td>${actual().gpa === null ? "—" : sign(p.gpa - actual().gpa)}</td><td>${num(m.gpa)}</td><td>${p.remainingUnplanned} gereklilik</td></tr>`;
      })
      .join(
        "",
      )}</tbody></table></div><div class="inline-note">${icon("info")} Olasılıklı derslerde beklenen ortalama kullanılır. Farklı kapsamda planları mezuniyet sonucu olarak karşılaştırma.</div>`,
    true,
  );
}
function probabilityDialog(id) {
  const c = allCourses().find((c) => c.id === id),
    e = plannedEntry(id);
  const distribution = e.distribution || { AA: 20, BA: 50, BB: 30 };
  openDialog(
    `${esc(c.code)} not olasılıkları`,
    `<p>“BA gelme ihtimali daha yüksek” diyorsan her nota bir yüzde ver. Bunlar senin varsayımların.</p><form id="probability-form"><div class="probability-grid">${letterGrades.map((g) => `<label><span>${g}<small>${num(gradePoints[g], 1)}</small></span><div class="number-suffix"><input type="number" min="0" max="100" step=".1" value="${distribution[g] || 0}" data-prob-grade="${g}" aria-label="${g} olasılığı"><span>%</span></div></label>`).join("")}</div><div class="probability-total" id="probability-total"></div><div class="dialog-actions"><button type="button" class="button secondary" id="remove-probability">Olasılıkları kaldır</button><button class="button primary" type="submit" id="save-probability">Senaryoya uygula ${icon("arrow")}</button></div></form>`,
  );
  const check = () => {
    const inputs = [...document.querySelectorAll("[data-prob-grade]")],
      total = inputs.reduce((s, x) => s + Number(x.value), 0),
      valid =
        Math.abs(total - 100) < 1e-9 && inputs.every((x) => x.validity.valid);
    $("#probability-total").textContent =
      `Toplam: %${num(total, 1)}${valid ? " · Hazır" : " · %100 olmalı"}`;
    $("#probability-total").classList.toggle("warning-text", !valid);
    $("#save-probability").disabled = !valid;
  };
  $("#probability-form").addEventListener("input", check);
  check();
  $("#probability-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const d = Object.fromEntries(
      [...document.querySelectorAll("[data-prob-grade]")].map((x) => [
        x.dataset.probGrade,
        Number(x.value),
      ]),
    );
    closeDialog();
    mutate(() => {
      activeScenario().courses[id] = {
        ...plannedEntry(id),
        grade: "",
        distribution: d,
      };
    }, "Olasılıklar senaryona eklendi.");
  });
  $("#remove-probability").addEventListener("click", () => {
    closeDialog();
    mutate(() => {
      const next = { ...plannedEntry(id) };
      delete next.distribution;
      activeScenario().courses[id] = next;
    });
  });
}
function randomDialog() {
  openDialog(
    "Tahminleri doldur",
    `<p>Yalnızca gelecek derslerin tahmini notlarını değiştirir. Gerçek notların korunur.</p><form id="random-form"><label for="fill-scope">Hangi dersler?</label><select id="fill-scope"><option value="remaining">Tüm kalan kredili dersler</option><option value="year3">Müfredattaki 3. sınıf dersleri</option><option value="year4">Müfredattaki 4. sınıf dersleri</option><option value="year5">Planımdaki 5. yıl dersleri</option>${Array.from(
      {
        length:
          state.profile.graduationSemester - state.profile.currentSemester + 1,
      },
      (_, i) => i + state.profile.currentSemester,
    )
      .map((t) => `<option value="term-${t}">Planımdaki ${t}. dönem</option>`)
      .join(
        "",
      )}</select><label for="fill-mode">Nasıl dolduralım?</label><select id="fill-mode"><option value="balanced">Rastgele · CC ile AA arasında</option><option value="optimistic">İyimser · BB / BA / AA</option><option value="cautious">Temkinli · DD / DC / CC / CB</option><option value="AA">Hepsi AA (4,00)</option><option value="BA">Hepsi BA (3,50)</option><option value="BB">Hepsi BB (3,00)</option><option value="CB">Hepsi CB (2,50)</option><option value="CC">Hepsi CC (2,00)</option></select><label class="checkbox-label"><input id="fill-replace" type="checkbox"> Bu kapsamdaki mevcut tahminleri de değiştir</label><div class="inline-note">${icon("info")} Rastgele dağıtım eşit olasılıklıdır. Başarı ihtimalini tahmin etmez; “ya böyle olursa?” denemesidir.</div><div class="dialog-actions"><button type="button" class="button secondary" data-action="close-dialog">Vazgeç</button><button class="button primary" type="submit">Doldur ve sonucu gör ${icon("spark")}</button></div></form>`,
  );
  $("#random-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const scope = $("#fill-scope").value,
      mode = $("#fill-mode").value,
      replace = $("#fill-replace").checked;
    closeDialog();
    fillPredictions(scope, mode, replace);
  });
}
function fillPredictions(scope, mode, replace = true) {
  const pool = {
    balanced: ["CC", "CB", "BB", "BA", "AA"],
    optimistic: ["BB", "BA", "AA"],
    cautious: ["DD", "DC", "CC", "CB"],
  }[mode] || [mode];
  let count = 0;
  mutate(() => {
    for (const c of visibleCourses()) {
      const e = activeScenario().courses[c.id];
      if (
        c.credits === 0 ||
        isPassed(state.transcript[c.id]) ||
        (!replace && (e?.grade || e?.distribution))
      )
        continue;
      const t = e?.term || defaultTerm(c),
        base = baseCourses.find((x) => x.id === c.id);
      if (scope === "year3" && Math.ceil(base?.semester / 2) !== 3) continue;
      if (scope === "year4" && Math.ceil(base?.semester / 2) !== 4) continue;
      if (scope === "year5" && Math.ceil(t / 2) !== 5) continue;
      if (scope.startsWith("term-") && t !== Number(scope.slice(5))) continue;
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      const next = {
        ...plannedEntry(c.id),
        grade: pool[Math.floor((arr[0] / 4294967296) * pool.length)],
        term: t,
      };
      delete next.distribution;
      activeScenario().courses[c.id] = next;
      count++;
    }
  });
  toast(
    count
      ? `${count} dersin tahmini dolduruldu. Gerçek notların değişmedi.`
      : "Bu kapsamda doldurulacak ders yok.",
  );
}
function courseDialog(id = "") {
  const c = allCourses().find((c) => c.id === id);
  const options =
    c?.kind === "minor-elective"
      ? minorOptions.filter((o) => !o.majorRequired)
      : c?.minorGroup && !c.major
        ? minorRequiredAlternatives[c.minorGroup] || []
        : [];
  openDialog(
    c ? `${esc(c.code)} · ders bilgisi` : "Ders planına bir ek.",
    `<form id="course-form">${options.length ? `<label for="catalog-choice">Resmî listedeki derslerden seç</label><select id="catalog-choice"><option value="">Ders seç…</option>${options.map((o) => `<option value="${esc(o.id)}" ${o.code === c?.code ? "selected" : ""}>${esc(o.code)} · ${esc(o.name)} (${o.credits} kr.)</option>`).join("")}</select>` : ""}<div class="form-grid"><label>Ders kodu<input type="text" id="edit-code" maxlength="40" required value="${esc(c?.code || "")}" placeholder="Örn. ME 461"></label><label>Yerel kredi<input type="number" id="edit-credits" min="0" max="30" step=".5" required value="${c?.credits ?? 3}"></label></div><label>Ders adı<input type="text" id="edit-name" maxlength="160" required value="${esc(c?.name || "")}" placeholder="Dersin tam adı"></label><label for="edit-semester">${state.transcript[id] ? "Dersi aldığın dönem" : "Varsayılan dönem"}</label><select id="edit-semester">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === (c ? courseSemester(c) || state.profile.currentSemester : state.profile.currentSemester) ? "selected" : ""}>${i + 1}. dönem · ${Math.ceil((i + 1) / 2)}. yıl</option>`).join("")}</select><div class="form-grid"><label class="checkbox-label"><input type="checkbox" id="edit-major" ${c?.major !== false ? "checked" : ""}> Anadalda sayılıyor</label><label class="checkbox-label"><input type="checkbox" id="edit-minor" ${c?.minor ? "checked" : ""}> Yandalda sayılıyor</label></div>${c?.kind === "restricted" ? `<p class="small muted">Bölümün kısıtlı seçmeli listesi: ${restrictedOptions.join(", ")}.</p>` : ""}<p class="small muted">${c?.minorApprovalRequired ? "Ortak saydırma için danışman onayı gerekir. " : ""}Gerçek ders ve kredisini onaylı transkriptine göre düzenle. Kimliği korunur; kayıtlı notun kaybolmaz.</p><div id="course-error" class="form-error" role="alert"></div><div class="dialog-actions">${state.customCourses.some((x) => x.id === id) ? '<button type="button" class="button secondary danger-link" id="delete-custom">Bu dersi kaldır</button>' : ""}<button type="button" class="button secondary" data-action="close-dialog">Vazgeç</button><button type="submit" class="button primary">Kaydet ${icon("check")}</button></div></form>`,
  );
  $("#catalog-choice")?.addEventListener("change", (event) => {
    const o = options.find((x) => x.id === event.target.value);
    if (o) {
      $("#edit-code").value = o.code;
      $("#edit-name").value = o.name;
      $("#edit-credits").value = o.credits;
    }
  });
  $("#course-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = {
      code: $("#edit-code").value.trim(),
      name: $("#edit-name").value.trim(),
      credits: Number($("#edit-credits").value),
      semester: Number($("#edit-semester").value),
      major: $("#edit-major").checked,
      minor: $("#edit-minor").checked,
    };
    const duplicate = allCourses().find(
      (x) =>
        x.id !== id &&
        x.code.replace(/\s/g, "").toUpperCase() ===
          data.code.replace(/\s/g, "").toUpperCase(),
    );
    if (duplicate) {
      $("#course-error").textContent =
        `${duplicate.code} zaten listede. Aynı dersi iki kez eklemek ortalamayı yanıltır. Ortak bir dersse mevcut dersin sayıldığı programları düzenle.`;
      return;
    }
    if (!data.major && !data.minor) {
      $("#course-error").textContent = "En az bir program seç.";
      return;
    }
    closeDialog();
    mutate(() => {
      if (id)
        state.courseOverrides[id] = { ...state.courseOverrides[id], ...data };
      else
        state.customCourses.push({
          id: newId("custom"),
          ...data,
          kind: "required",
        });
    }, "Ders bilgisi kaydedildi.");
  });
  $("#delete-custom")?.addEventListener("click", () => {
    closeDialog();
    confirmDialog(
      "Bu dersi kaldır?",
      "Gerçek notu ve tüm senaryolardaki tahminleri de kaldırılır. Geri al düğmesiyle geri getirebilirsin.",
      "Dersi kaldır",
      () =>
        mutate(() => {
          state.customCourses = state.customCourses.filter((x) => x.id !== id);
          delete state.transcript[id];
          delete state.courseOverrides[id];
          state.scenarios.forEach((s) => delete s.courses[id]);
        }, "Ders kaldırıldı."),
    );
  });
}
function dataDialog() {
  openDialog(
    "Yedekle ve içe aktar",
    `<p>Bir yedek al, başka cihaza taşı veya bir chatbot ile yeni senaryolar dene.</p><div class="data-actions"><button class="data-action" data-action="copy-json">${icon("copy")}<strong>JSON’u kopyala</strong><span>Notlar + tüm senaryolar</span></button><button class="data-action" data-action="download-json">${icon("download")}<strong>Dosya olarak indir</strong><span>Kişisel .json yedeğin</span></button><button class="data-action" data-action="copy-chatgpt">${icon("spark")}<strong>ChatGPT için kopyala</strong><span>Veriler + kurallar + isteğin</span></button></div><p class="small muted">Kopyaladığın metin notlarını içerir. Bir chatbot'a yapıştırdığında bu verileri onunla paylaşmış olursun.</p><details class="export-details"><summary>Aktarım metnini göster / elle kopyala</summary><textarea id="export-preview" class="json-area" rows="7" readonly aria-label="Dışa aktarılacak JSON">${esc(exportJSON(state))}</textarea></details><div class="form-divider"></div><div class="panel-heading"><h3>Bir planı içe aktar</h3><label class="button secondary small file-label">${icon("download")} Dosya seç<input type="file" id="import-file" accept="application/json,.json" class="file-input"></label></div><label for="import-json">JSON’u buraya yapıştır</label><textarea id="import-json" class="json-area" rows="7" spellcheck="false" placeholder="Kendi yedeğin veya ChatGPT’den aldığın JSON…"></textarea><p class="small muted">Bu uygulamanın plan biçimi kabul edilir. Kod bloğu içindeki JSON da olur. Önce kontrol eder, sonra onayını isteriz.</p><div id="import-error" class="form-error" role="alert"></div><div id="import-preview"></div><div class="dialog-actions"><button class="button secondary" data-action="close-dialog">Kapat</button><button class="button primary" id="validate-import">Kontrol et ve önizle ${icon("arrow")}</button></div>`,
    true,
  );
  $("#import-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      $("#import-error").textContent = "Dosya 2 MB sınırını aşıyor.";
      return;
    }
    $("#import-json").value = await file.text();
    $("#import-preview").innerHTML = "";
    $("#import-error").textContent = "";
  });
  $("#import-json").addEventListener("input", () => {
    $("#import-preview").innerHTML = "";
    $("#import-error").textContent = "";
  });
  $("#validate-import").addEventListener("click", () => {
    $("#import-error").textContent = "";
    $("#import-preview").innerHTML = "";
    try {
      const imported = parseImport($("#import-json").value, baseCourses);
      const changed = Object.keys({
        ...state.transcript,
        ...imported.transcript,
      }).filter(
        (id) => state.transcript[id] !== imported.transcript[id],
      ).length;
      $("#import-preview").innerHTML =
        `<div class="import-preview"><span class="pill sage">BİÇİM DOĞRU</span><h3>${imported.scenarios.length} senaryo · ${Object.keys(imported.transcript).length} gerçek not</h3><p>${changed ? `Dikkat: mevcut transkriptinden ${changed} not farklı. ` : "Gerçek notlarında değişiklik yok. "}İçe aktarma, bu tarayıcıdaki planın tamamını değiştirir. Önce bir yedek kopyalayabilirsin.</p><button class="button primary" id="apply-import">Bu planı içe aktar ${icon("check")}</button></div>`;
      $("#apply-import").addEventListener(
        "click",
        () => {
          closeDialog();
          mutate(() => {
            state = imported;
          }, "Plan içe aktarıldı. İstersen geri alabilirsin.");
        },
        { once: true },
      );
    } catch (error) {
      $("#import-error").textContent = error.message;
    }
  });
}
async function copyText(text, label) {
  if ($("#export-preview")) {
    $("#export-preview").value = text;
    $("#export-preview").setAttribute("aria-label", label + " aktarım metni");
  }
  try {
    if (!navigator.clipboard?.writeText) throw Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
    toast(`${label} kopyalandı.`);
  } catch {
    openDialog(
      "Metni seçip kopyala.",
      `<p>Tarayıcı otomatik kopyalamaya izin vermedi. Metni seçip Ctrl/Cmd+C ile kopyalayabilirsin.</p><textarea id="copy-fallback" class="json-area" rows="12" readonly aria-label="Kopyalanacak metin">${esc(text)}</textarea><div class="dialog-actions"><button class="button primary" data-action="close-dialog">Tamam</button></div>`,
      true,
    );
    $("#copy-fallback").select();
  }
}
function downloadJSON() {
  const url = URL.createObjectURL(
    new Blob([exportJSON(state)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `not-plani-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("Yedek dosyası indiriliyor.");
}
function settingsDialog() {
  openDialog(
    "Plan ayarları",
    `<form id="settings-form"><div class="form-grid"><label>Şu an kaçıncı dönemdesin?<select id="setting-current">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === state.profile.currentSemester ? "selected" : ""}>${i + 1}. dönem · ${Math.ceil((i + 1) / 2)}. yıl</option>`).join("")}</select></label><label>Planın kaç dönem sürsün?<select id="setting-graduation">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === state.profile.graduationSemester ? "selected" : ""}>${i + 1}. dönem · ${Math.ceil((i + 1) / 2)}. yıl</option>`).join("")}</select></label></div><label>Soyadı grubu<select id="setting-group"><option value="A" ${state.profile.group === "A" ? "selected" : ""}>A–KA</option><option value="B" ${state.profile.group === "B" ? "selected" : ""}>KA–Z</option></select></label><p class="small muted">Eski uygulamadaki müfredat sırası korunur. Gerçek dönem atamalarını sürükleyerek değiştirebilirsin. Güncel şube / soyadı düzenini bölümden kontrol et.</p><label class="checkbox-label"><input type="checkbox" id="setting-minor" ${state.profile.minorEnabled ? "checked" : ""}> Mekatronik yandalını göster</label><label>Hedef anadal GNO<input type="number" id="setting-target" min="0" max="4" step=".01" value="${state.profile.target}" required></label><div id="settings-error" class="form-error" role="alert"></div><div class="dialog-actions"><button type="button" class="button secondary" data-action="sources">Kaynaklar & hesap yöntemi</button><button type="submit" class="button primary">Kaydet</button></div></form><div class="form-divider"></div><button class="subtle-link danger-link" data-action="reset">Boş bir transkriptle yeniden başla</button>`,
  );
  $("#settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const currentSemester = Number($("#setting-current").value),
      graduationSemester = Number($("#setting-graduation").value);
    if (graduationSemester < currentSemester) {
      $("#settings-error").textContent =
        "Planın bitişi, şu anki döneminden önce olamaz.";
      return;
    }
    const profile = {
      group: $("#setting-group").value,
      minorEnabled: $("#setting-minor").checked,
      target: Number($("#setting-target").value),
      currentSemester,
      graduationSemester,
    };
    closeDialog();
    mutate(() => {
      state.profile = profile;
      if (!profile.minorEnabled) {
        if (ui.page === "minor") ui.page = "overview";
        ui.program = "major";
      }
    }, "Ayarlar kaydedildi.");
  });
}
function sourcesDialog() {
  openDialog(
    "Neyi, nasıl hesaplıyoruz?",
    `<div class="method-grid"><div><h3>Gerçek not ≠ tahmin</h3><p>Transkriptim senin kaydındır. Senaryolar bu kaydı değiştirmeden bir geleceği hesaplar. Boş notlar ortalamaya girmez.</p></div><div><h3>Krediyle ağırlıklandırma</h3><p>GNO = Σ (yerel kredi × not katsayısı) / notlandırılmış yerel kredi. AKTS kullanılmaz. Hesap içinde yuvarlama yapılmaz.</p></div><div><h3>Tekrar ve dönemler</h3><p>Son geçerli tekrar notu eskisinin yerini alır; ikisi birden birikimli ortalamaya eklenmez. Dönem GNO’su yalnızca o dönemdeki notlu denemelerdir. Transkriptte ders başına son gerçek not tutulur; eski tekrar geçmişi varsa resmî geçmiş dönem GNO’su tam kurulamaz.</p></div><div><h3>Belirsizlik</h3><p>Olasılıkları sen belirlersin. Beklenen değer tam ağırlıklı hesap, aralıklar 4.000 örnek simülasyondur. Ders sonuçları bağımsız varsayılır; gerçek hayatta ilişkili olabilir.</p></div></div><div class="grade-scale">${letterGrades.map((g) => `<span><b>${g}</b> ${num(gradePoints[g], 1)}</span>`).join("")}</div><div class="inline-note">${icon("info")} Müfredat şablonu 24 Eylül 2026 tarihinde resmî kaynaklarla kontrol edildi. Anadal varsayılanı 141 yerel kredi; seçmeli kredileri ve giriş yılı gereklilikleri değişebilir. Derslerin açılması, ön koşullar ve danışman onayı bu araç tarafından doğrulanmaz.</div><h3>Resmî kaynaklar</h3><div class="source-list">${sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noreferrer"><span>${esc(s.title)}</span>${icon("arrow")}</a>`).join("")}</div>`,
    true,
  );
}
function loadExample() {
  const apply = () => {
    mutate(() => {
      state = createState();
      state.example = true;
      const grades = ["BA", "BB", "AA", "BA", "BB", "BA", "AA", "BB"];
      let idx = 0;
      for (const c of baseCourses.filter((c) => c.major && c.semester <= 4)) {
        state.transcript[c.id] = c.credits
          ? grades[idx++ % grades.length]
          : "S";
      }
      state.transcript.PHYS105 = "BB";
      activeScenario().name = "5 yıllık planım";
      for (const c of baseCourses.filter((c) => c.major && c.semester >= 5)) {
        let term = c.semester;
        if (["ME307", "ME311", "ECON210"].includes(c.id)) term = 7;
        else if (c.semester === 7) term = 9;
        else if (c.semester === 8) term = 10;
        activeScenario().courses[c.id] = {
          grade: c.credits ? "BB" : "S",
          term,
        };
      }
      for (const c of baseCourses.filter((c) => !c.major)) {
        activeScenario().courses[c.id] = {
          grade: "BA",
          term: c.kind === "minor-elective" ? 9 : 7,
        };
      }
      const id = newId("plan");
      state.scenarios.push({
        id,
        name: "PHYS 105 tekrar + aynı gelecek",
        courses: {
          ...structuredClone(activeScenario().courses),
          PHYS105: { grade: "AA", term: 5 },
        },
      });
    }, "Tamamen örnek notlar yüklendi. Gerçek öğrenci verisi değildir.");
  };
  if (hasUserWork())
    confirmDialog(
      "Örnek veriye geç?",
      "Mevcut planın örnek veriyle değişir. Önce dışa aktarabilirsin; sonrasında geri al düğmesi de kullanılabilir.",
      "Örneği yükle",
      apply,
    );
  else apply();
}
function moveCourse(id, term, isActual) {
  const c = allCourses().find((c) => c.id === id);
  if (!c) return;
  if (!isActual && state.transcript[id] && term <= (courseSemester(c) || 1)) {
    toast("Tekrarı, gerçek notun alındığı dönemden sonraya taşı.", true);
    return;
  }
  if (
    isActual &&
    activeScenario().courses[id]?.grade &&
    term >= activeScenario().courses[id].term
  ) {
    toast("Gerçek ders, planlanan tekrarından önce olmalı.", true);
    return;
  }
  mutate(() => {
    if (isActual)
      state.courseOverrides[id] = {
        ...state.courseOverrides[id],
        semester: term,
      };
    else activeScenario().courses[id] = { ...plannedEntry(id), term };
  }, `${c.code}, ${term}. döneme taşındı.`);
}
function updateExam(field, index, value) {
  const c = allCourses().find((c) => c.id === ui.examId),
    e = plannedEntry(c.id);
  const assessments = structuredClone(
    e.assessments || [
      { name: "Vize", weight: 30, score: null },
      { name: "Ödev / proje", weight: 20, score: null },
      { name: "Final", weight: 50, score: null },
    ],
  );
  if (field === "remove") assessments.splice(index, 1);
  else if (field === "add")
    assessments.push({
      name: `Değerlendirme ${assessments.length + 1}`,
      weight: 0,
      score: null,
    });
  else
    assessments[index][field] =
      field === "name"
        ? value
        : field === "score" && value === ""
          ? null
          : Number(value);
  mutate(() => {
    activeScenario().courses[c.id] = { ...plannedEntry(c.id), assessments };
  });
}
let lastExamInput = null;
function captureExamInputs(changedElement) {
  const assessments = [...document.querySelectorAll(".assessment-row")].map(
    (row) => ({
      name: row.querySelector('[data-exam-field="name"]').value,
      weight: Number(row.querySelector('[data-exam-field="weight"]').value),
      score:
        row.querySelector('[data-exam-field="score"]').value === ""
          ? null
          : Number(row.querySelector('[data-exam-field="score"]').value),
    }),
  );
  const target = Number($("#exam-target").value);
  $("#exam-result").innerHTML = examResult(assessments, target);
  const next = structuredClone(state);
  next.scenarios.find((s) => s.id === next.activeScenarioId).courses[
    ui.examId
  ] = { ...plannedEntry(ui.examId), assessments, examTarget: target };
  try {
    const valid = validateState(next, baseCourses);
    if (lastExamInput !== changedElement) {
      history.push(structuredClone(state));
      if (history.length > 30) history.shift();
      lastExamInput = changedElement;
    }
    state = valid;
    persist();
    document.querySelector('[data-action="undo"]').disabled = false;
  } catch {
    /* Incomplete typing stays visible until the field contains a valid value. */
  }
}
const actions = {
  "close-dialog": closeDialog,
  data: dataDialog,
  settings: settingsDialog,
  sources: sourcesDialog,
  example: loadExample,
  undo: () => {
    if (!history.length) return;
    state = history.pop();
    persist();
    render();
    toast("Son değişiklik geri alındı.");
  },
  "dismiss-notice": () => {
    notice = "";
    render();
  },
  "clear-example": () =>
    confirmDialog(
      "Kendi notlarınla başlayalım.",
      "Örnek notlar ve örnek senaryolar temizlenir. Beş yıllık boş şablon hazır olur.",
      "Kendi notlarımla başla",
      () => {
        mutate(() => {
          state = createState();
          ui.page = "transcript";
        });
      },
    ),
  reset: () =>
    confirmDialog(
      "Boş bir planla yeniden başla?",
      "Notların ve senaryoların temizlenir. Devam etmeden bir yedek alabilirsin.",
      "Yeni boş plan",
      () =>
        mutate(() => {
          state = createState();
          ui.page = "overview";
        }, "Boş plan hazır."),
    ),
  "add-course": () => courseDialog(),
  "edit-course": (el) => courseDialog(el.dataset.id),
  "new-scenario": () => nameDialog(),
  "rename-scenario": () => nameDialog(false, true),
  "duplicate-scenario": () => nameDialog(true),
  compare: compareDialog,
  "delete-scenario": () => {
    if (state.scenarios.length <= 1) return;
    confirmDialog(
      "Bu senaryoyu sil?",
      `${esc(activeScenario().name)} kaldırılacak. Gerçek notların korunur.`,
      "Senaryoyu sil",
      () =>
        mutate(() => {
          state.scenarios = state.scenarios.filter(
            (s) => s.id !== state.activeScenarioId,
          );
          state.activeScenarioId = state.scenarios[0].id;
        }),
    );
  },
  "select-scenario": (el) => {
    closeDialog();
    mutate(() => {
      state.activeScenarioId = el.dataset.id;
      ui.page = "scenarios";
    });
  },
  "bulk-grade": (el) => fillPredictions("remaining", el.dataset.gradeValue),
  "random-fill": randomDialog,
  "planner-course": (el) =>
    plannerCourseDialog(el.dataset.id, el.dataset.actual === "true"),
  "planner-retake": (el) => plannerRetakeDialog(el.dataset.id),
  "planner-exam": (el) => {
    ui.examId = el.dataset.id;
    go("exams");
  },
  "planner-clear": (el) => {
    closeDialog();
    actions["clear-plan"](el);
  },
  "board-view": () => {
    ui.planView = "board";
    render();
  },
  "list-view": () => {
    ui.planView = "list";
    render();
  },
  probability: (el) => probabilityDialog(el.dataset.id),
  "clear-plan": (el) =>
    mutate(() => {
      const e = { ...plannedEntry(el.dataset.id), grade: "" };
      delete e.distribution;
      activeScenario().courses[el.dataset.id] = e;
    }),
  "select-retake": (el) => {
    ui.retakeId = el.dataset.id;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  },
  "apply-retake": () =>
    mutate(() => {
      const e = { ...plannedEntry(ui.retakeId), grade: ui.retakeGrade };
      delete e.distribution;
      activeScenario().courses[ui.retakeId] = e;
    }, "Ders tekrarı aktif senaryona eklendi."),
  "add-exam": () => updateExam("add"),
  "remove-exam": (el) => updateExam("remove", Number(el.dataset.index)),
  "copy-json": () => copyText(exportJSON(state), "JSON"),
  "copy-chatgpt": () =>
    copyText(chatGPTPrompt(state, baseCourses), "ChatGPT metni"),
  "download-json": downloadJSON,
};
document.addEventListener("click", (event) => {
  const page = event.target.closest("[data-page]");
  if (page) {
    event.preventDefault();
    go(page.dataset.page);
    return;
  }
  const year = event.target.closest("[data-year]");
  if (year) {
    ui.year = year.dataset.year;
    render();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (button && !button.disabled) {
    const action = actions[button.dataset.action];
    if (action) {
      Promise.resolve(action(button)).catch((error) =>
        toast(error.message, true),
      );
    }
  }
});
document.addEventListener("input", (event) => {
  if (event.target.dataset.examField || event.target.id === "exam-target") {
    captureExamInputs(event.target);
    return;
  }
  if (event.target.id === "course-search") {
    ui.search = event.target.value;
    render();
  }
  if (event.target.id === "target-gpa") {
    const out = $(".target-label output");
    if (out) out.textContent = num(Number(event.target.value));
  }
});
document.addEventListener("change", (event) => {
  const el = event.target;
  if (el.dataset.grade) {
    const id = el.dataset.id,
      g = el.value;
    mutate(() => {
      if (el.dataset.grade === "actual") {
        if (g) {
          state.transcript[id] = g;
          const actualTerm =
            courseSemester(allCourses().find((c) => c.id === id)) ||
            state.profile.currentSemester;
          for (const scenario of state.scenarios) {
            const plan = scenario.courses[id];
            if (plan && plan.term <= actualTerm) {
              plan.grade = "";
              delete plan.distribution;
            }
          }
        } else delete state.transcript[id];
      } else {
        const e = { ...plannedEntry(id), grade: g };
        delete e.distribution;
        activeScenario().courses[id] = e;
      }
    });
    return;
  }
  if (el.dataset.term) {
    moveCourse(el.dataset.term, Number(el.value), false);
    return;
  }
  if (el.dataset.moveCourse) {
    moveCourse(
      el.dataset.moveCourse,
      Number(el.value),
      el.dataset.moveActual === "true",
    );
    return;
  }
  if (el.dataset.examField || el.id === "exam-target") {
    captureExamInputs(el);
    return;
  }
  if (el.id === "active-scenario")
    mutate(() => {
      state.activeScenarioId = el.value;
    });
  if (el.id === "target-gpa")
    mutate(() => {
      state.profile.target = Number(el.value);
    });
  if (el.id === "program-filter") {
    ui.program = el.value;
    render();
  }
  if (el.id === "status-filter") {
    ui.status = el.value;
    render();
  }
  if (el.id === "retake-course") {
    ui.retakeId = el.value;
    render();
  }
  if (el.id === "retake-grade") {
    ui.retakeGrade = el.value;
    render();
  }
  if (el.id === "exam-course") {
    ui.examId = el.value;
    render();
  }
  if (el.id === "show-history") {
    ui.showHistory = el.checked;
    render();
  }
});
let dragData = null;
document.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-drag-course]");
  if (!card) return;
  if (event.target.closest("select,button,input")) {
    event.preventDefault();
    return;
  }
  dragData = {
    id: card.dataset.dragCourse,
    actual: card.dataset.dragActual === "true",
  };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  card.classList.add("dragging");
});
document.addEventListener("dragover", (event) => {
  const target = event.target.closest("[data-drop-term]");
  if (target && dragData) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    document
      .querySelectorAll(".drop-target")
      .forEach((el) => el.classList.remove("drop-target"));
    target.classList.add("drop-target");
  }
});
document.addEventListener("drop", (event) => {
  const target = event.target.closest("[data-drop-term]");
  if (target && dragData) {
    event.preventDefault();
    const data = dragData;
    dragData = null;
    moveCourse(data.id, Number(target.dataset.dropTerm), data.actual);
  }
});
document.addEventListener("dragend", () => {
  dragData = null;
  document
    .querySelectorAll(".dragging,.drop-target")
    .forEach((el) => el.classList.remove("dragging", "drop-target"));
});
$("#dialog").addEventListener("click", (event) => {
  if (event.target === $("#dialog")) {
    const rect = event.target.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      closeDialog();
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === "metuMePlanner.v2" && event.newValue) {
    notice =
      "Plan başka bir sekmede değişti. Buradaki değişikliklerin üzerine yazmamak için önce yedek al, sonra sayfayı yenile.";
    render();
  }
});
render();
