// Checks the built site in dist/ (run `npm run build` first).
// The live site's content policy (vercel.json) blocks some things that work
// fine in `npm run dev`, so this catches them before they are published.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

const pages = htmlFiles("dist");

test("the site was built", () => {
  assert.ok(pages.length > 0, "No pages in dist/. Run npm run build first.");
});

// style-src 'self' only allows stylesheet files, so a <style> tag in a page
// is ignored on the live site and its styles vanish.
test("no page has a <style> tag", () => {
  for (const page of pages) {
    const html = readFileSync(page, "utf8");
    assert.ok(
      !/<style[\s>]/i.test(html),
      `${page} has a <style> tag, which the live site blocks. ` +
        `Keep build.inlineStylesheets: "never" in astro.config.mjs.`,
    );
  }
});
