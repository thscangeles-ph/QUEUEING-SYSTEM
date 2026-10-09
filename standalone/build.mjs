// Builds the whole Queue Board into one HTML file: public/thsc-queue-board.html.
// Run with `pnpm build:html` after changing any queue screen, and commit the result.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const here = (file) => path.join(root, file);
const output = here("public/thsc-queue-board.html");

// Swap the Next.js-only modules for single-file versions.
const swaps = {
  "next/link": here("standalone/shims/link.tsx"),
  "next/navigation": here("standalone/shims/navigation.ts"),
  "@/components/pwa": here("standalone/shims/pwa.tsx"),
  "./endpoint": here("standalone/endpoint.ts"),
};
const swapPlugin = {
  name: "standalone-swaps",
  setup(builder) {
    builder.onResolve({ filter: /^(next\/link|next\/navigation|@\/components\/pwa|\.\/endpoint)$/ }, (args) => {
      if (args.path === "./endpoint" && !args.importer.startsWith(here("components/queue"))) return undefined;
      return { path: swaps[args.path] };
    });
  },
};

const bundle = await build({
  entryPoints: [here("standalone/main.tsx")],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  target: ["chrome100", "safari15", "firefox100", "edge100"],
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
  plugins: [swapPlugin],
  logLevel: "warning",
});

const cssSource = here("app/globals.css");
const css = await postcss([tailwind({ base: root, optimize: { minify: true } })]).process(await readFile(cssSource, "utf8"), { from: cssSource });

const dataUri = async (file, type) => `data:${type};base64,${(await readFile(here(file))).toString("base64")}`;
const logo = await dataUri("public/theheartspecialists.png", "image/png");
const favicon = await dataUri("public/favicon.svg", "image/svg+xml");

// The logo appears on several screens: define it once instead of repeating the image in each.
const bundled = bundle.outputFiles[0].text.replaceAll('"/theheartspecialists.png"', "THSC_LOGO");
const script = `var THSC_LOGO=${JSON.stringify(logo)};${bundled}`.replaceAll("</script", "<\\/script");
if (script.includes("/theheartspecialists.png")) throw new Error("The clinic logo was not inlined.");

const html = `<!doctype html>
<html lang="en-PH">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#2f281c">
<meta name="description" content="THSC Queue Board in one file: front desk, stations, lobby TV and patient check-in, synced between computers.">
<title>THSC Queue Board</title>
<link rel="icon" href="${favicon}">
<style>${css.css}</style>
</head>
<body class="antialiased">
<div id="root"></div>
<noscript>The Queue Board needs JavaScript. Open this file in Chrome, Edge, Firefox or Safari.</noscript>
<script>${script}</script>
</body>
</html>
`;

await writeFile(output, html);
console.log(`Wrote ${path.relative(root, output)} (${Math.round(html.length / 1024)} KB)`);
