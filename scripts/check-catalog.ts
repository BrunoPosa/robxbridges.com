import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { CatalogError, loadCatalog, parseCatalog } from "../src/data/catalog.ts";

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (/\.(astro|ts|js|mjs|css)$/.test(entry.name)) found.push(full);
  }
  return found;
}

function sample(parts?: {
  films?: string;
  dictionary?: string;
  social?: string;
}): string {
  return `
## Site
- Name: Rob Bridges
- Role: Film composer, musician, filmmaker
- Email: robbridgesmusic@gmail.com

## Social
- YouTube:
- Instagram:
- Bandcamp: https://robbridgesmusic.bandcamp.com/
- Spotify: https://open.spotify.com/artist/2kS1RhFIh7qOvtp0PNv1uh?si=SHARE
${parts?.social ?? ""}

## Music
- Bandcamp: https://robbridgesmusic.bandcamp.com/
- Spotify: https://open.spotify.com/artist/2kS1RhFIh7qOvtp0PNv1uh?si=SHARE

### Tracks / videos
- I: LUNA (156): https://www.youtube.com/watch?v=o4ZE9Ps4XQY

## Films
${
  parts?.films ??
  `- Aryk!: https://www.youtube.com/watch?v=N7bynxXfhKI&t=1744s
  - summary: Opening piece.
  - credits: Music by Rob Bridges`
}

### Chinese Dictionary
${parts?.dictionary ?? "- Flow: https://www.instagram.com/p/DGVfSDux34g/"}

## Collaborations
- Ada Example: https://example.com/ada
  - role: Director
  - project: Aryk
  - year: 2024

## About
First paragraph.

Second paragraph.
`;
}

function fails(source: string, pattern: RegExp): void {
  assert.throws(
    () => parseCatalog(source),
    (error: unknown) => {
      assert.ok(error instanceof CatalogError);
      assert.match(error.message, pattern);
      return true;
    },
  );
}

test("the works file matches the rules", () => {
  const catalog = loadCatalog();

  assert.match(catalog.films[0]?.title ?? "", /^aryk\b/i);
  assert.equal(typeof catalog.films[0]?.startSeconds, "number");
  assert.ok((catalog.films[0]?.startSeconds ?? 0) > 0);

  assert.ok(catalog.music.tracks.length > 0);
  assert.ok(catalog.films.length > 0);
  assert.ok(catalog.dictionary.length > 0);

  for (const track of catalog.music.tracks) {
    assert.equal(track.youtubeId.length, 11);
  }
  for (const film of catalog.films) {
    assert.equal(film.youtubeId.length, 11);
    assert.match(film.url, /^https:\/\/www\.youtube\.com\/watch\?/);
  }
  for (const piece of catalog.dictionary) {
    assert.match(piece.url, /^https:\/\/www\.instagram\.com\/p\/[A-Za-z0-9_-]+\/?$/);
  }

  assert.match(catalog.music.bandcamp, /^https:\/\/.+bandcamp\.com\/?$/);
  assert.match(catalog.social.bandcamp, /^https:\/\/.+bandcamp\.com\/?$/);
  assert.equal(catalog.social.spotify.includes("si="), false);
  assert.equal(catalog.music.spotify.includes("si="), false);
  assert.match(catalog.site.email, /@/);
  assert.equal(
    catalog.social.youtube.startsWith("https://") || catalog.social.youtube === "",
    true,
  );
  assert.equal(
    catalog.social.instagram.startsWith("https://") || catalog.social.instagram === "",
    true,
  );
});

test("titles may contain colons, and notes stay on that work", () => {
  const catalog = parseCatalog(sample());
  assert.equal(catalog.music.tracks[0]?.title, "I: LUNA (156)");
  assert.equal(catalog.films[0]?.startSeconds, 1744);
  assert.equal(catalog.films[0]?.summary, "Opening piece.");
  assert.equal(catalog.films[0]?.credits, "Music by Rob Bridges");
  assert.equal(catalog.collaborations[0]?.role, "Director");
  assert.equal(catalog.collaborations[0]?.year, "2024");
  assert.match(catalog.about, /First paragraph/);
  assert.match(catalog.about, /Second paragraph/);
  assert.equal(catalog.social.spotify.includes("si="), false);
});

test("a film that is not YouTube is rejected", () => {
  fails(
    sample({
      films: "- Aryk!: https://example.com/not-youtube",
    }),
    /YouTube/,
  );
});

test("Aryk without a start time is rejected", () => {
  fails(
    sample({
      films: "- Aryk!: https://www.youtube.com/watch?v=N7bynxXfhKI",
    }),
    /start time/,
  );
});

test("a dictionary link must be an Instagram post", () => {
  fails(
    sample({
      dictionary: "- Flow: https://www.youtube.com/watch?v=o4ZE9Ps4XQY",
    }),
    /Instagram/,
  );
});

test("duplicate titles are rejected", () => {
  fails(
    sample({
      films: `- Aryk!: https://www.youtube.com/watch?v=N7bynxXfhKI&t=1744s
- Aryk!: https://www.youtube.com/watch?v=v4UQOVjNgGU`,
    }),
    /twice/,
  );
});

test("a missing section is rejected", () => {
  fails(sample().replace(/## Social[\s\S]*?(?=## Music)/, ""), /## Social/);
});

test("the site source cannot send email", () => {
  const offenders = sourceFiles("src").filter((file) => {
    const text = fs.readFileSync(file, "utf8");
    return /mailto:/i.test(text) || /web3forms|formspree|api\.resend\.com|nodemailer/i.test(text);
  });
  assert.deepEqual(offenders, []);
});
