import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const moduleNames = ["curriculum.js", "engine.js", "state.js", "app.js"];
const assets = [
  "index.html",
  "style.css",
  ...moduleNames,
  "favicon.svg",
  "SOURCES.md",
];

// This deliberately small bundler supports the named imports and declaration
// exports used by this app. Separate closures keep each module's private scope.
export function bundleModule(source, filename, availableModules) {
  const exported = [];
  const imports = [];
  let body = source.replace(
    /^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm,
    (_, names, specifier) => {
      const dependency = specifier.replace(/^\.\//, "");
      if (!specifier.startsWith("./") || !availableModules.has(dependency)) {
        throw new Error(
          `${filename}: unsupported or out-of-order import ${specifier}`,
        );
      }
      const bindings = names.trim().replace(/,$/, "").split(",").map((name) => {
        const match = name
          .trim()
          .match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
        if (!match) throw new Error(`${filename}: unsupported import ${name}`);
        if (!availableModules.get(dependency).includes(match[1])) {
          throw new Error(
            `${filename}: ${dependency} does not export ${match[1]}`,
          );
        }
        return match[2] ? `${match[1]}: ${match[2]}` : match[1];
      });
      imports.push(
        `const { ${bindings.join(", ")} } = modules[${JSON.stringify(dependency)}];`,
      );
      return "";
    },
  );
  body = body.replace(
    /^export\s+((?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*))/gm,
    (_, declaration, name) => {
      exported.push(name);
      return declaration;
    },
  );
  if (/^\s*(?:import|export)\b/m.test(body)) {
    throw new Error(
      `${filename}: unsupported module syntax; update the local bundler explicitly`,
    );
  }
  return {
    exports: exported,
    code: `// ${filename}\nmodules[${JSON.stringify(filename)}] = (() => {\n${imports.join("\n")}\n${body.trim()}\nreturn { ${exported.join(", ")} };\n})();`,
  };
}

function replaceOnce(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`index.html: missing ${label}`);
  return source.replace(pattern, () => replacement);
}

export async function build({
  rootDir = projectRoot,
  outputDir = path.join(rootDir, "dist"),
} = {}) {
  const [html, css, favicon, ...sources] = await Promise.all([
    readFile(path.join(rootDir, "index.html"), "utf8"),
    readFile(path.join(rootDir, "style.css"), "utf8"),
    readFile(path.join(rootDir, "favicon.svg"), "utf8"),
    ...moduleNames.map((name) => readFile(path.join(rootDir, name), "utf8")),
  ]);
  const available = new Map();
  const modules = sources.map((source, index) => {
    const name = moduleNames[index];
    const bundled = bundleModule(source, name, available);
    available.set(name, bundled.exports);
    return bundled.code;
  });
  const script = `(() => {\n'use strict';\nconst modules = Object.create(null);\n${modules.join("\n\n")}\n})();`;
  let standalone = replaceOnce(
    html,
    /<link\s+rel="stylesheet"\s+href="style\.css"\s*\/?>/,
    `<style>\n${css.replace(/<\/style/gi, "<\\/style")}\n</style>`,
    "local stylesheet",
  );
  standalone = replaceOnce(
    standalone,
    /<script\s+type="module"\s+src="app\.js"\s*>\s*<\/script>/,
    `<script>\n${script.replace(/<\/script/gi, "<\\/script")}\n</script>`,
    "app module",
  );
  standalone = replaceOnce(
    standalone,
    /href="favicon\.svg"/,
    `href="data:image/svg+xml,${encodeURIComponent(favicon).replace(/'/g, "%27")}"`,
    "favicon",
  );

  const siteDir = path.join(outputDir, "site");
  await mkdir(siteDir, { recursive: true });
  await Promise.all(
    assets.map((name) =>
      copyFile(path.join(rootDir, name), path.join(siteDir, name)),
    ),
  );
  const standalonePath = path.join(outputDir, "pusula.html");
  await writeFile(standalonePath, standalone);
  return { standalonePath, siteDir };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await build();
  console.log(
    `Standalone: ${result.standalonePath}\nStatic site: ${result.siteDir}\nLocal build only. Nothing was pushed or deployed.`,
  );
}
