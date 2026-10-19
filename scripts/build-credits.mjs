#!/usr/bin/env node
// Builds credits/: CREDITS.md and credits/licenses/ with the license text of every open-source package the
// website and the clinic server use (from `pnpm licenses list --prod`), plus Tailwind CSS and shadcn/ui, which
// make the website's styles. Run it after changing dependencies: node scripts/build-credits.mjs
// SheetJS (inside the Queue Board file) and Node.js (inside the server package) are not in node_modules; their
// license files in credits/licenses/ are kept as they are.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "credits");
const licensesDir = path.join(out, "licenses");
const KEEP = { sheetjs: "xlsx@0.18.5.txt", node: "node@v24.21.0.txt" };

const fileName = (name, version) => `${name.replace("/", "__")}@${version}.txt`;
const licenseFile = (dir) => fs.readdirSync(dir).find((file) => /^(licen[cs]e|copying)/i.test(file));
const cell = (text) => String(text ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
// Packages that do not name an author in package.json.
const AUTHORS = { next: "Vercel", react: "Meta Platforms, Inc. and affiliates", "react-dom": "Meta Platforms, Inc. and affiliates", "radix-ui": "WorkOS" };
const author = (value, name) => cell(typeof value === "object" && value ? value.name : value) || AUTHORS[name] || "";

// Start from a clean folder, keeping the two hand-placed license files.
fs.mkdirSync(licensesDir, { recursive: true });
for (const file of fs.readdirSync(licensesDir)) if (!Object.values(KEEP).includes(file)) fs.rmSync(path.join(licensesDir, file));

/** Copies a package's license text (or a note when it has none) and returns its file name. */
function copyLicense(name, version, dir, license) {
  const target = fileName(name, version);
  const found = licenseFile(dir);
  const text = found
    ? fs.readFileSync(path.join(dir, found), "utf8")
    : `${name} ${version} is licensed under ${license}, as stated in its package.json. The package has no separate license file.\n`;
  fs.writeFileSync(path.join(licensesDir, target), text);
  return target;
}

const listed = JSON.parse(execSync("pnpm licenses list --prod --json", { cwd: root, encoding: "utf8" }));
const all = [];
for (const [license, pkgs] of Object.entries(listed)) {
  for (const pkg of pkgs) {
    pkg.versions.forEach((version, i) => {
      all.push({ name: pkg.name, version, license, author: author(pkg.author, pkg.name), file: copyLicense(pkg.name, version, pkg.paths[i] ?? pkg.paths[0], license) });
    });
  }
}
all.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

// The website's styles: Tailwind CSS (a build tool whose output is in the site) and shadcn/ui (vendor/).
const tailwindDir = path.join(root, "node_modules", "tailwindcss");
const tailwind = JSON.parse(fs.readFileSync(path.join(tailwindDir, "package.json"), "utf8"));
const styles = [
  { name: "Tailwind CSS", version: tailwind.version, license: tailwind.license, author: "Tailwind Labs", file: copyLicense("tailwindcss", tailwind.version, tailwindDir, tailwind.license), use: "Styles of the website pages" },
  { name: "shadcn/ui", version: "4.13.0", license: "MIT", author: "shadcn", use: "Base styles of the website's buttons and form fields" },
];
fs.copyFileSync(path.join(root, "vendor", "shadcn-tailwind-4.13.0.LICENSE.md"), path.join(licensesDir, (styles[1].file = fileName("shadcn-ui", "4.13.0"))));

const pkgJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const uses = {
  next: "Website and server framework",
  react: "Building the website pages",
  "react-dom": "Showing the website pages in the browser",
  "radix-ui": "Building blocks of the website's buttons",
  "lucide-react": "Icons",
  qrcode: "QR code on the check-in poster",
  "class-variance-authority": "Button and badge styles",
  clsx: "Combining style classes",
  "tailwind-merge": "Combining style classes",
};
const direct = Object.keys(pkgJson.dependencies).map((name) => {
  const item = all.find((pkg) => pkg.name === name);
  return { ...item, use: uses[name] ?? "" };
});
const row = (pkg) => `| ${cell(pkg.name)} | ${cell(pkg.version)} | ${cell(pkg.license)} | ${pkg.author || "—"} | ${pkg.use ?? ""} | [${pkg.file}](licenses/${encodeURI(pkg.file)}) |`;
const head = "| Software | Version | License | Author | Used for | License text |\n| --- | --- | --- | --- | --- | --- |";

const md = `# Credits — THSC Queue Board

**THSC Queue Board** is the patient queuing system of **The Heart Specialists Clinic (THSC)**: front desk and Concierge, stations, the lobby TV with spoken announcements, QR queue numbers and the patient's phone page.

- **Made for:** The Heart Specialists Clinic. The clinic's name, logo (\`public/theheartspecialists.png\`) and texts belong to the clinic.
- **Built by:** the clinic's staff with [Claude Code](https://claude.com/claude-code) (Anthropic). Source code: [thscangeles-ph/QUEUEING-SYSTEM](https://github.com/thscangeles-ph/QUEUEING-SYSTEM).
- **Fonts and voices:** the board uses the computer's own fonts (Aptos, Segoe UI) and speech voices; none are included.

## Open-source software

THSC Queue Board is built on the open-source software below. Thank you to its authors. The full license text of each is in the [licenses](licenses/) folder.

### Inside the Queue Board file (\`public/thsc-queue-board.html\`)

${head}
| SheetJS Community Edition (xlsx) | 0.18.5 | Apache-2.0 | SheetJS LLC | Excel report (Download report) | [${KEEP.sheetjs}](licenses/${KEEP.sheetjs}) |

### Website and server (main parts)

${head}
${direct.map(row).join("\n")}
${styles.map(row).join("\n")}

### Ready-to-run server package (\`THSC-Queue-Server.zip\`)

${head}
| Node.js | v24.21.0 | MIT (with the licenses of its own bundled parts in the same file) | OpenJS Foundation and Node.js contributors | Runs the clinic server on Windows | [${KEEP.node}](licenses/${KEEP.node}) |

### All packages installed with the website

Everything \`pnpm\` installs for the website, including the packages above, the parts they depend on, and tools used only while building it (some are not included in what runs at the clinic).

| Package | Version | License | Author | License text |
| --- | --- | --- | --- | --- |
${all.map((pkg) => `| ${cell(pkg.name)} | ${cell(pkg.version)} | ${cell(pkg.license)} | ${pkg.author || "—"} | [${pkg.file}](licenses/${encodeURI(pkg.file)}) |`).join("\n")}

_${all.length} packages. Generated by \`scripts/build-credits.mjs\`._
`;
fs.writeFileSync(path.join(out, "CREDITS.md"), md);
console.log(`Wrote credits/CREDITS.md and ${fs.readdirSync(licensesDir).length} license files.`);
