import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { build, bundleModule } from "../scripts/build.mjs";

test("portable build has one syntactically valid classic script and no local asset dependencies", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "pusula-build-"));
  try {
    const { standalonePath, siteDir } = await build({ outputDir });
    const standalone = await readFile(standalonePath, "utf8");
    assert.doesNotMatch(standalone, /<script[^>]+(?:src=|type="module")/);
    assert.doesNotMatch(
      standalone,
      /href="(?:style\.css|planner\.css|favicon\.svg)(?:\?[^"<>]*)?"/,
    );
    assert.match(standalone, /href="data:image\/svg\+xml,/);
    const scripts = [...standalone.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1);
    assert.doesNotMatch(scripts[0][1], /^\s*(?:import|export)\b/m);
    assert.doesNotThrow(
      () => new vm.Script(scripts[0][1], { filename: "pusula.html" }),
    );
    const siteHtml = await readFile(path.join(siteDir, "index.html"), "utf8");
    assert.match(siteHtml, /type="module" src="app\.js(?:\?[^"<>]*)?"/);
    for (const name of [
      "style.css",
      "planner.css",
      "app.js",
      "engine.js",
      "state.js",
      "curriculum.js",
      "favicon.svg",
      "SOURCES.md",
    ]) {
      assert.ok(
        (await readFile(path.join(siteDir, name))).length > 0,
        `${name} is included`,
      );
    }
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("bundler preserves module scopes and named import aliases", () => {
  const a = bundleModule("export const gradePoints = 4;", "a.js", new Map());
  const b = bundleModule("export const gradePoints = 3;", "b.js", new Map());
  const app = bundleModule(
    "import { gradePoints as first } from './a.js';\nimport { gradePoints as second } from './b.js';\nexport const sum = first + second;",
    "app.js",
    new Map([
      ["a.js", a.exports],
      ["b.js", b.exports],
    ]),
  );
  const result = vm.runInNewContext(
    `(() => { const modules = {}; ${a.code}\n${b.code}\n${app.code}\nreturn modules['app.js'].sum; })()`,
  );
  assert.equal(result, 7);
});

test("bundler rejects unsupported syntax and missing imports instead of shipping broken output", () => {
  assert.throws(
    () => bundleModule("export default 42;", "a.js", new Map()),
    /unsupported module syntax/,
  );
  assert.throws(
    () =>
      bundleModule(
        "import { absent } from './a.js';",
        "b.js",
        new Map([["a.js", ["present"]]]),
      ),
    /does not export absent/,
  );
  assert.throws(
    () =>
      bundleModule("import { value } from './later.js';", "a.js", new Map()),
    /out-of-order import/,
  );
});
