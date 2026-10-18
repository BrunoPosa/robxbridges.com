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

### LUNA EP
- Album: https://robbridgesmusic.bandcamp.com/album/luna-ep
- Player: 283143371
- Cover: public/images/covers/luna-ep.jpg
- I: LUNA (156): https://www.youtube.com/watch?v=o4ZE9Ps4XQY
  - player: 2438719346

## Films
${
  parts?.films ??
  `- Aryk!: https://www.youtube.com/watch?v=N7bynxXfhKI&t=1744s
  - summary: Opening piece.
  - credits: Music by Rob Bridges`
}

### Chinese Dictionary
${
  parts?.dictionary ??
  `- Flow: https://www.instagram.com/p/DGVfSDux34g/
  - poster: public/films/flow.jpg`
}

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

  assert.equal(catalog.music.albums.length, 20);
  assert.ok(catalog.films.length > 0);
  assert.ok(catalog.dictionary.length > 0);

  for (const album of catalog.music.albums) {
    for (const track of album.tracks) {
      if (track.youtubeId) assert.equal(track.youtubeId.length, 11);
    }
  }
  for (const film of catalog.films) {
    assert.equal(film.youtubeId.length, 11);
    assert.match(film.url, /^https:\/\/www\.youtube\.com\/watch\?/);
  }
  for (const piece of catalog.dictionary) {
    assert.match(piece.url, /^https:\/\/www\.instagram\.com\/p\/[A-Za-z0-9_-]+\/?$/);
    assert.match(piece.poster ?? "", /^public\/films\/[a-z0-9-]+\.jpg$/);
    assert.equal(fs.existsSync(piece.poster), true);
  }

  const luna = catalog.music.albums[0];
  assert.equal(luna?.title, "LUNA EP");
  assert.equal(luna?.kind, "album");
  assert.equal(luna?.playerId, "283143371");
  assert.match(
    luna?.url ?? "",
    /^https:\/\/robbridgesmusic\.bandcamp\.com\/album\/luna-ep\/?$/,
  );
  assert.equal(luna?.cover, "public/images/covers/luna-ep.jpg");
  assert.deepEqual(
    luna?.tracks.map((track) => track.title),
    [
      "I: LUNA (156)",
      "II: SOL",
      "Rude Wun",
      "Mind.Body.Soul",
      "The One You Didn't Expect",
    ],
  );
  assert.deepEqual(
    luna?.tracks.map((track) => track.playerId),
    ["2438719346", "3165008200", "493796160", "1961603828", "3607538238"],
  );
  assert.deepEqual(
    luna?.tracks.filter((track) => track.youtubeId).map((track) => track.youtubeId),
    ["o4ZE9Ps4XQY", "6Vi-Av_RqP8", "SoAd-e3edfo"],
  );
  const single = catalog.music.albums.find((album) => album.title === "i believe now");
  assert.equal(single?.kind, "track");
  assert.equal(single?.tracks.length, 0);
  assert.equal(
    catalog.music.albums.find((album) => album.title === "Jupiter")?.credit,
    "Rob Bridges X Earl Duke",
  );
  for (const album of catalog.music.albums) {
    assert.equal(fs.existsSync(album.cover), true);
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
  assert.equal(catalog.music.albums[0]?.tracks[0]?.title, "I: LUNA (156)");
  assert.equal(catalog.films[0]?.startSeconds, 1744);
  assert.equal(catalog.films[0]?.summary, "Opening piece.");
  assert.equal(catalog.films[0]?.credits, "Music by Rob Bridges");
  assert.equal(catalog.collaborations[0]?.role, "Director");
  assert.equal(catalog.collaborations[0]?.project, "Aryk");
  assert.equal(catalog.collaborations[0]?.year, "2024");
  assert.match(catalog.about, /First paragraph/);
  assert.match(catalog.about, /Second paragraph/);
  assert.equal(catalog.social.spotify.includes("si="), false);
});

test("an incomplete release is rejected", () => {
  fails(sample().replace("- Cover: public/images/covers/luna-ep.jpg", ""), /Cover/);
});

test("a second release is kept", () => {
  const catalog = parseCatalog(
    sample().replace(
      "### LUNA EP",
      `### i believe now
- Album: https://robbridgesmusic.bandcamp.com/track/i-believe-now
- Player: 797509581
- Cover: public/images/covers/i-believe-now.jpg

### LUNA EP`,
    ),
  );
  assert.equal(catalog.music.albums.length, 2);
  assert.equal(catalog.music.albums[0]?.kind, "track");
  assert.equal(catalog.music.albums[0]?.tracks.length, 0);
  assert.equal(catalog.music.albums[1]?.title, "LUNA EP");
});

test("a bad player number is rejected", () => {
  fails(sample().replace("- Player: 283143371", "- Player: not-a-number"), /Player/);
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

test("a dictionary piece needs a still", () => {
  fails(
    sample({
      dictionary: "- Flow: https://www.instagram.com/p/DGVfSDux34g/",
    }),
    /still/,
  );
});

test("a dictionary poster must be a still in public/films", () => {
  fails(
    sample({
      dictionary: `- Flow: https://www.instagram.com/p/DGVfSDux34g/
  - poster: ../secret.jpg`,
    }),
    /poster/,
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

function pngInfo(buf: Buffer): { width: number; height: number; alpha: boolean } {
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(buf.subarray(12, 16).toString("ascii"), "IHDR");
  const colorType = buf[25];
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    alpha: colorType === 4 || colorType === 6,
  };
}

function jpegSize(buf: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset + 8 < buf.length) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = buf.readUInt16BE(offset + 2);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  throw new Error("Could not read the hero JPEG size.");
}

test("the home still is a matched pair", () => {
  const plate = fs.readFileSync("public/images/hero-plate.jpg");
  const cutout = fs.readFileSync("public/images/hero-foreground.png");
  const photo = jpegSize(plate);
  const foreground = pngInfo(cutout);
  assert.equal(foreground.alpha, true);
  assert.equal(foreground.width, photo.width);
  assert.equal(foreground.height, photo.height);
  assert.ok(photo.width >= 1000);
});

test("the site source cannot send email", () => {
  const offenders = sourceFiles("src").filter((file) => {
    const text = fs.readFileSync(file, "utf8");
    return (
      /mailto:/i.test(text) ||
      /web3forms|formspree|api\.resend\.com|nodemailer/i.test(text)
    );
  });
  assert.deepEqual(offenders, []);
});
