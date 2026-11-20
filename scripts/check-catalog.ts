import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { test } from "node:test";
import {
  CatalogError,
  loadCatalog,
  parseCatalog,
  slugify,
} from "../src/data/catalog.ts";

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
  - poster: public/films/flow.jpg
  - video: public/films/flow.mp4`
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

  assert.equal(catalog.music.albums.length, 19);
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
    assert.match(piece.video, /^public\/films\/[a-z0-9-]+\.mp4$/);
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
- Credit: Rob Bridges X Earl Duke

### LUNA EP`,
    ),
  );
  assert.equal(catalog.music.albums.length, 2);
  assert.equal(catalog.music.albums[0]?.credit, "Rob Bridges X Earl Duke");
  assert.equal(catalog.music.albums[1]?.credit, undefined);
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

test("a dictionary piece needs a video", () => {
  fails(
    sample({
      dictionary: `- Flow: https://www.instagram.com/p/DGVfSDux34g/
  - poster: public/films/flow.jpg`,
    }),
    /needs a video/,
  );
});

test("a dictionary video must be an MP4 in public/films", () => {
  fails(
    sample({
      dictionary: `- Flow: https://www.instagram.com/p/DGVfSDux34g/
  - poster: public/films/flow.jpg
  - video: public/films/flow.mov`,
    }),
    /video needs a path/,
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

test("a film year and the Chinese Dictionary group line are kept", () => {
  const catalog = parseCatalog(
    sample({
      films: `- Aryk!: https://www.youtube.com/watch?v=N7bynxXfhKI&t=1744s
  - year: 2026
  - summary: Opening piece.`,
      dictionary: `- Year: 2022–2025
- Summary: Composer and sound designer.
- Instagram: https://www.instagram.com/p/CgjfzfvjmpX/
- Flow: https://www.instagram.com/p/DGVfSDux34g/
  - poster: public/films/flow.jpg
  - video: public/films/flow.mp4`,
    }),
  );
  assert.equal(catalog.films[0]?.year, "2026");
  assert.equal(catalog.dictionaryInfo.year, "2022–2025");
  assert.equal(catalog.dictionaryInfo.summary, "Composer and sound designer.");
  assert.equal(
    catalog.dictionaryInfo.instagram,
    "https://www.instagram.com/p/CgjfzfvjmpX/",
  );
  assert.equal(catalog.dictionary.length, 1);
});

test("the Chinese Dictionary Instagram line must be a post", () => {
  fails(
    sample({
      dictionary: `- Instagram: https://www.instagram.com/thechinesedictionary/
- Flow: https://www.instagram.com/p/DGVfSDux34g/
  - poster: public/films/flow.jpg
  - video: public/films/flow.mp4`,
    }),
    /Expected an Instagram post link/,
  );
});

test("the Chinese Dictionary group line must come before its pieces", () => {
  fails(
    sample({
      dictionary: `- Flow: https://www.instagram.com/p/DGVfSDux34g/
  - poster: public/films/flow.jpg
  - video: public/films/flow.mp4
- Summary: Too late.`,
    }),
    /above the first/,
  );
});

test("a collaboration may add an Instagram link, and only Instagram", () => {
  const withInstagram = sample().replace(
    "  - year: 2024",
    "  - year: 2024\n  - instagram: https://www.instagram.com/notxlocal/",
  );
  assert.equal(
    parseCatalog(withInstagram).collaborations[0]?.instagram,
    "https://www.instagram.com/notxlocal/",
  );
  fails(
    sample().replace(
      "  - year: 2024",
      "  - year: 2024\n  - instagram: https://example.com/x",
    ),
    /Instagram/,
  );
});

test("a collaboration may add a cover and a Bandcamp player number", () => {
  const withBoth = sample().replace(
    "  - year: 2024",
    "  - year: 2024\n  - cover: public/images/collabs/ada.jpg\n  - player: 1234567890",
  );
  const collaboration = parseCatalog(withBoth).collaborations[0];
  assert.equal(collaboration?.cover, "public/images/collabs/ada.jpg");
  assert.equal(collaboration?.playerId, "1234567890");
  fails(
    sample().replace("  - year: 2024", "  - year: 2024\n  - player: track=12"),
    /track=/,
  );
  fails(
    sample().replace("  - year: 2024", "  - year: 2024\n  - cover: public/ada.png"),
    /public\/images\/collabs/,
  );
});

test("every collaboration cover file exists", () => {
  for (const collaboration of loadCatalog().collaborations) {
    if (collaboration.cover) {
      assert.ok(fs.existsSync(collaboration.cover), `missing ${collaboration.cover}`);
    }
  }
});

test("bio links point at works on the site", () => {
  const source = sample().replace(
    "Second paragraph.",
    "Scored [Aryk!], made [the clips](Flow), worked [with Ada](Ada Example), see [Straight8](https://straight8.net/).",
  );
  const links = parseCatalog(source)
    .aboutParagraphs.flat()
    .filter((piece) => piece.href);
  assert.deepEqual(links, [
    { text: "Aryk!", href: "/films#aryk" },
    { text: "the clips", href: "/films#chinese-dictionary" },
    { text: "with Ada", href: "/collaborations#aryk" },
    { text: "Straight8", href: "https://straight8.net/", external: true },
  ]);
});

test("a bio link can land on a release's videos", () => {
  const source = sample().replace(
    "Second paragraph.",
    "See [the videos](LUNA EP videos) and [the single](I: LUNA (156)).",
  );
  const links = parseCatalog(source)
    .aboutParagraphs.flat()
    .filter((piece) => piece.href);
  assert.deepEqual(
    links.map((piece) => piece.href),
    ["/music#luna-ep-videos", "/music#luna-ep-videos"],
  );
});

test("a bio link to an unknown work is rejected", () => {
  fails(
    sample().replace("Second paragraph.", "See [Aryk 2]."),
    /About links to "Aryk 2"/,
  );
});

test("the real bio links all land on a work", () => {
  const catalog = loadCatalog();
  const ids = new Set<string>();
  for (const film of catalog.films) ids.add(`/films#${slugify(film.title)}`);
  ids.add("/films#chinese-dictionary");
  for (const album of catalog.music.albums) {
    ids.add(`/music#${slugify(album.title)}`);
    ids.add(`/music#${slugify(album.title)}-videos`);
  }
  for (const collaboration of catalog.collaborations) {
    ids.add(`/collaborations#${slugify(collaboration.project ?? collaboration.name)}`);
  }
  for (const page of ["/music", "/films", "/collaborations"]) ids.add(page);
  for (const piece of catalog.aboutParagraphs.flat()) {
    if (piece.href && !piece.external) assert.ok(ids.has(piece.href), piece.href);
  }
});

test("titles that would share a web address are rejected", () => {
  fails(
    sample({
      films: `- Aryk!: https://www.youtube.com/watch?v=N7bynxXfhKI&t=1744s
- Aryk?: https://www.youtube.com/watch?v=fluSgAKaUnk`,
    }),
    /too alike/,
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
  throw new Error("Could not read the JPEG size.");
}

test("album covers stay small enough to load quickly", () => {
  const catalog = loadCatalog();
  const problems: string[] = [];
  for (const album of catalog.music.albums) {
    const buf = fs.readFileSync(album.cover);
    const size = jpegSize(buf);
    const edge = Math.max(size.width, size.height);
    const kb = Math.ceil(buf.length / 1024);
    if (edge > 900 || buf.length > 250 * 1024) {
      problems.push(
        `${album.cover} is ${size.width}×${size.height} and ${kb}KB. Resize it to about 800px.`,
      );
    }
  }
  assert.deepEqual(problems, []);
});

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
  const footer = fs.readFileSync("src/components/Footer.astro", "utf8");
  assert.match(footer, /note\.textContent = "Nothing was sent\."/);
  assert.equal(/note\.textContent = "[^"]*being built/.test(footer), false);
});

// Public images must not carry a location, an email, or a content-credentials manifest.
function imageFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...imageFiles(full));
    else if (/\.(jpe?g|png)$/i.test(entry.name)) found.push(full);
  }
  return found;
}

function jpegMeta(buf: Buffer): Buffer[] {
  const segments: Buffer[] = [];
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return segments;
  let offset = 2;
  while (offset + 4 < buf.length) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1] ?? 0;
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = buf.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (end > buf.length) break;
    if (marker >= 0xe0 && marker <= 0xef) segments.push(buf.subarray(offset + 4, end));
    offset = end;
  }
  return segments;
}

function pngMeta(buf: Buffer): Buffer[] {
  const chunks: Buffer[] = [];
  if (buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return chunks;
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "eXIf" || type === "tEXt" || type === "iTXt") chunks.push(data);
    if (type === "zTXt" && data.length > 2) {
      const split = data.indexOf(0);
      if (split >= 0) {
        try {
          chunks.push(zlib.inflateSync(data.subarray(split + 2)));
        } catch {
          chunks.push(data);
        }
      }
    }
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

function tiffHasGps(tiff: Buffer): boolean {
  if (tiff.length < 8) return false;
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const big = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!little && !big) return false;
  const u16 = (offset: number) =>
    little ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset);
  const u32 = (offset: number) =>
    little ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset);
  const seen = new Set<number>();
  const walk = (offset: number, depth: number): boolean => {
    if (depth > 6 || offset < 0 || offset + 2 > tiff.length || seen.has(offset))
      return false;
    seen.add(offset);
    const count = u16(offset);
    for (let index = 0; index < count; index += 1) {
      const entry = offset + 2 + index * 12;
      if (entry + 12 > tiff.length) return false;
      const tag = u16(entry);
      if (tag === 0x8825) return true;
      if (tag === 0x8769 && walk(u32(entry + 8), depth + 1)) return true;
    }
    const nextAt = offset + 2 + count * 12;
    if (nextAt + 4 <= tiff.length) {
      const next = u32(nextAt);
      if (next !== 0 && walk(next, depth + 1)) return true;
    }
    return false;
  };
  try {
    return walk(u32(4), 0);
  } catch {
    return false;
  }
}

function metaHasGps(segment: Buffer): boolean {
  const marker = Buffer.from("Exif\u0000\u0000");
  const at = segment.indexOf(marker);
  if (at >= 0) return tiffHasGps(segment.subarray(at + marker.length));
  return tiffHasGps(segment);
}

test("public images carry no location, email, or content credentials", () => {
  const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const offenders: string[] = [];
  for (const file of imageFiles("public")) {
    const buf = fs.readFileSync(file);
    const meta = file.toLowerCase().endsWith(".png") ? pngMeta(buf) : jpegMeta(buf);
    const reasons: string[] = [];
    if (meta.some((segment) => segment.includes("c2pa") || segment.includes("C2PA"))) {
      reasons.push("content credentials");
    }
    if (meta.some((segment) => email.test(segment.toString("latin1"))))
      reasons.push("email");
    if (meta.some((segment) => metaHasGps(segment))) reasons.push("gps");
    if (reasons.length > 0) offenders.push(`${file} (${reasons.join(", ")})`);
  }
  assert.deepEqual(offenders, []);
});

// The top-level boxes of an MP4, in file order (e.g. ftyp, moov, mdat).
function mp4Boxes(buf: Buffer): string[] {
  const names: string[] = [];
  let offset = 0;
  while (offset + 8 <= buf.length) {
    let size = buf.readUInt32BE(offset);
    const name = buf.toString("latin1", offset + 4, offset + 8);
    if (size === 1) size = Number(buf.readBigUInt64BE(offset + 8));
    else if (size === 0) size = buf.length - offset;
    if (size < 8) break;
    names.push(name);
    offset += size;
  }
  return names;
}

// The clip length in seconds, from the mvhd box inside moov.
function mp4Seconds(buf: Buffer): number {
  const at = buf.indexOf("mvhd", 0, "latin1");
  if (at === -1) return 0;
  const version = buf.readUInt8(at + 4);
  if (version === 1) {
    return Number(buf.readBigUInt64BE(at + 28)) / buf.readUInt32BE(at + 24);
  }
  return buf.readUInt32BE(at + 20) / buf.readUInt32BE(at + 16);
}

// Each clip must exist, start playing before it has fully downloaded
// ("fast start": the moov index comes before the mdat video data), stream
// smoothly on a normal connection (2.6 Mbps or less), stay under 25 MB, and
// carry no phone location. scripts/encode-video.sh does all of this.
test("Chinese Dictionary clips are light, fast-start, and clean", () => {
  for (const piece of loadCatalog().dictionary) {
    const buf = fs.readFileSync(piece.video);
    assert.ok(buf.length <= 25 * 1024 * 1024, `${piece.video} is over 25 MB.`);
    const megabits = (buf.length * 8) / 1_000_000 / mp4Seconds(buf);
    assert.ok(
      megabits <= 2.6,
      `${piece.video} is ${megabits.toFixed(1)} Mbps, over 2.6. Make it with scripts/encode-video.sh.`,
    );
    const boxes = mp4Boxes(buf);
    assert.equal(boxes[0], "ftyp", `${piece.video} is not an MP4.`);
    const moov = boxes.indexOf("moov");
    const mdat = boxes.indexOf("mdat");
    assert.ok(
      moov !== -1 && mdat !== -1 && moov < mdat,
      `${piece.video} is not fast-start. Re-encode it with scripts/encode-video.sh.`,
    );
    assert.equal(
      buf.includes("\xa9xyz", 0, "latin1"),
      false,
      `${piece.video} has a location.`,
    );
  }
});
