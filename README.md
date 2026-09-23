# Pusula

A static, Turkish-language degree and GPA planner for METU Mechanical Engineering and the Mechatronics minor. Start from an empty transcript, enter your actual grades, then compare possible futures across a five-year plan.

[Open the planner](https://celilygt.github.io/metu-me-gpa/). The app needs no account or backend.

## Open it

With Node.js and Python 3 installed, no dependency installation is needed:

```sh
npm start
```

Open [http://127.0.0.1:8767](http://127.0.0.1:8767). To check the calculation and data rules:

```sh
npm test
```

To create portable copies:

```sh
node scripts/build.mjs
```

- **`dist/pusula.html`** — one file to send to the student. Double-click it to open in a modern browser. All application code, styles and curriculum data are included. Optional Google Fonts need an internet connection; system fonts work offline. Export a JSON backup before moving the file or changing browsers, because local-file storage behavior varies by browser.
- **`dist/site/`** — the static website with relative asset paths, suitable for the existing GitHub Pages subdirectory. Serve or upload the contents so `index.html` is at the site's root.

The build reads only the application source assets. It does not read browser storage or embed anyone's grades. Opening an unused copy starts with no actual grades; sample grades appear only after choosing the example.

## The main journey

1. Open **Transkriptim** and enter first- and second-year grades. Update the actual course, local credits and completed semester where your transcript differs from the template. Empty grades are not zeros.
2. Open **Senaryolarım**. The default plan starts in semester 5 and ends in semester 10. Drag course cards between semesters, or use each card's semester selector on touchscreens and with a keyboard. Keep only three courses in semester 5 if that is your real plan; the semester and cumulative GPA calculations follow their placement.
3. Choose **Rastgele doldur → Müfredattaki 4. sınıf dersleri** to try later grades quickly. You can fill all remaining courses, a specific semester or the fifth year, choose a grade range, or give every selected course one grade. Actual transcript grades stay unchanged. Existing predictions are replaced only when requested.
4. Create or duplicate a named scenario to compare alternatives. Give individual courses letter grades or your own grade probabilities. The probability range reflects those assumptions, with independent course outcomes; it is not a prediction of academic performance.
5. Open **Tekrar almaya değer mi?** and try PHYS 105 from BB to AA. Compare the effect on today's GPA with the effect after the other planned courses. Add the repeat to a scenario to see it in a future semester. A worse latest grade can lower the cumulative GPA.
6. Use **Sınav hesabı** for weighted exams, assignments and a desired numeric course score. Letter-grade thresholds depend on the actual course; a numeric exam target does not establish a university letter grade.
7. Check **Mekatronik yandal** separately. Choose the actual approved courses and mark shared course counting only where it applies. Major and minor GPAs are separate.

The course list comes from official department and university sources. Elective slots, enrollment-year differences, local credits, course availability, prerequisites and shared-course approval must be checked against the student's own records. See [SOURCES.md](SOURCES.md) for the official links and precise limits.

## Save, share and use with a chatbot

The app saves locally in the current browser with `localStorage`. A static website can retain data this way without a server. Storage belongs to that browser and website address; clearing browser data, changing devices or moving between local and hosted copies does not carry the plan over automatically. If saving is unavailable, the app shows a warning and JSON export remains available.

The data dialog offers **JSON’u kopyala**, **Dosya olarak indir**, and **ChatGPT için kopyala**. The chatbot option includes the plan and calculation rules. Paste that text into a chatbot and describe the alternative to try. Paste its returned plan JSON into the import box, or choose a `.json` file. The app validates the format and previews the change before replacing your stored plan. Export first if you want to keep an independent backup.

Grades are not sent to a server by this app. Pasting them into a chatbot shares them with that service. The optional font requests do not include the plan. Anyone you give an exported JSON file to can read its grades.

The transcript stores the latest actual grade for each course. It does not preserve every historical repeat attempt, so it cannot reconstruct an official historical semester GPA when previous attempts are missing. Future repeats replace the earlier grade in cumulative GPA, while each semester GPA includes its own planned attempts. A calculated GPA or completion checklist is not university graduation approval.

## Publishing

The existing GitHub Pages site serves the `master` branch from the repository root. The source assets in this repository work directly at that path; no build or server is required. `dist/site/` is an equivalent portable copy. The build command never publishes anything. Use the personal repository owner's GitHub identity for authorized updates; keep unrelated GitHub accounts and global authentication unchanged.
