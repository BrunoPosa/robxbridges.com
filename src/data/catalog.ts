// Reads references/links.md — the file Rob edits — and checks that every
// work has the kind of link the page expects. Pages render this data.
// They do not keep their own copy of the titles.

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export type Track = {
  title: string;
  url: string;
  youtubeId: string;
  summary?: string;
};

export type Film = {
  title: string;
  url: string;
  youtubeId: string;
  startSeconds: number | null;
  summary?: string;
  credits?: string;
};

export type DictionaryPiece = {
  title: string;
  url: string;
  summary?: string;
  credits?: string;
};

export type Collaboration = {
  name: string;
  url: string;
  role?: string;
  project?: string;
  year?: string;
};

export type Catalog = {
  site: { name: string; role: string; email: string };
  social: {
    youtube: string;
    instagram: string;
    bandcamp: string;
    spotify: string;
  };
  music: { bandcamp: string; spotify: string; tracks: Track[] };
  films: Film[];
  dictionary: DictionaryPiece[];
  collaborations: Collaboration[];
  about: string;
  aboutPhoto?: string;
};

type Section = "site" | "social" | "music" | "films" | "collaborations" | "about";

type Bullet = {
  indent: number;
  label: string;
  value: string;
  isUrl: boolean;
};

type Last =
  | { kind: "track"; item: Track }
  | { kind: "film"; item: Film }
  | { kind: "dictionary"; item: DictionaryPiece }
  | { kind: "collaboration"; item: Collaboration };

const SECTION_HEADINGS: Record<string, Section> = {
  Site: "site",
  Social: "social",
  Music: "music",
  Films: "films",
  Collaborations: "collaborations",
  About: "about",
};

const httpsUrl = z
  .string()
  .refine((value) => value.startsWith("https://"), "Links must start with https://");

const CatalogShape = z.object({
  site: z.object({
    name: z.string().min(1, "Add a name under ## Site."),
    role: z.string().min(1, "Add a role under ## Site."),
    email: z
      .string()
      .refine(
        (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        "The Site email looks wrong.",
      ),
  }),
  social: z.object({
    youtube: z.union([z.literal(""), httpsUrl]),
    instagram: z.union([z.literal(""), httpsUrl]),
    bandcamp: httpsUrl,
    spotify: httpsUrl,
  }),
  music: z.object({
    bandcamp: httpsUrl,
    spotify: httpsUrl,
    tracks: z
      .array(
        z.object({
          title: z.string().min(1),
          url: httpsUrl,
          youtubeId: z.string().regex(YOUTUBE_ID),
          summary: z.string().min(1).optional(),
        }),
      )
      .min(1, "Add at least one track under Music."),
  }),
  films: z
    .array(
      z.object({
        title: z.string().min(1),
        url: httpsUrl,
        youtubeId: z.string().regex(YOUTUBE_ID),
        startSeconds: z.number().int().nonnegative().nullable(),
        summary: z.string().min(1).optional(),
        credits: z.string().min(1).optional(),
      }),
    )
    .min(1, "Add at least one film."),
  dictionary: z
    .array(
      z.object({
        title: z.string().min(1),
        url: httpsUrl,
        summary: z.string().min(1).optional(),
        credits: z.string().min(1).optional(),
      }),
    )
    .min(1, "Add at least one Chinese Dictionary piece."),
  collaborations: z.array(
    z.object({
      name: z.string().min(1),
      url: httpsUrl,
      role: z.string().min(1).optional(),
      project: z.string().min(1).optional(),
      year: z.string().min(1).optional(),
    }),
  ),
  about: z.string(),
  aboutPhoto: z.string().min(1).optional(),
});

export function readYouTube(url: string): { id: string; startSeconds: number | null } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CatalogError(`This is not a usable link: ${url}`);
  }

  const host = parsed.hostname.replace(/^www\./, "");
  let id = "";
  if (host === "youtu.be") {
    id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com"
  ) {
    id = parsed.searchParams.get("v") ?? "";
  } else {
    throw new CatalogError(`Expected a YouTube link: ${url}`);
  }

  if (!YOUTUBE_ID.test(id)) {
    throw new CatalogError(`Could not find the YouTube video id in ${url}`);
  }

  const raw = parsed.searchParams.get("t") ?? parsed.searchParams.get("start");
  if (raw === null) return { id, startSeconds: null };

  const seconds = Number(raw.replace(/s$/i, ""));
  if (!Number.isInteger(seconds) || seconds < 0) {
    throw new CatalogError(`The start time in ${url} needs to look like t=1744s.`);
  }
  return { id, startSeconds: seconds };
}

export function assertInstagramPost(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CatalogError(`This is not a usable link: ${url}`);
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "instagram.com" || !/^\/p\/[A-Za-z0-9_-]+\/?$/.test(parsed.pathname)) {
    throw new CatalogError(`Expected an Instagram post link: ${url}`);
  }
}

function stripSpotifyShare(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!parsed.hostname.endsWith("spotify.com")) return url;
  parsed.searchParams.delete("si");
  return parsed.toString();
}

function fail(lineNo: number, message: string): never {
  throw new CatalogError(`Line ${lineNo}: ${message}`);
}

function readBullet(line: string, lineNo: number): Bullet {
  const indent = line.match(/^ */)?.[0].length ?? 0;
  const trimmed = line.trim();
  if (!trimmed.startsWith("- ")) {
    fail(lineNo, 'expected a bullet starting with "- ".');
  }
  const body = trimmed.slice(2).trim();
  const urlMatch = body.match(/^(.*):\s+(https?:\/\/\S+)\s*$/);
  if (urlMatch) {
    const label = urlMatch[1]?.trim() ?? "";
    if (!label) fail(lineNo, "add a title before the link.");
    return { indent, label, value: urlMatch[2] ?? "", isUrl: true };
  }
  const field = body.match(/^([^:]+):\s*(.*)$/);
  if (!field) {
    fail(lineNo, 'use "Title: https://..." or "Label: value".');
  }
  return {
    indent,
    label: field[1]?.trim() ?? "",
    value: field[2]?.trim() ?? "",
    isUrl: false,
  };
}

function requireHttps(bullet: Bullet, lineNo: number): void {
  if (bullet.isUrl && !bullet.value.startsWith("https://")) {
    fail(lineNo, "use an https link.");
  }
}

function noteValue(bullet: Bullet, allowed: string[], lineNo: number): string {
  if (bullet.indent < 2) fail(lineNo, "indent notes with two spaces.");
  if (bullet.isUrl) {
    fail(lineNo, "indented lines are notes (summary, credits, role), not new links.");
  }
  if (!allowed.includes(bullet.label)) {
    fail(lineNo, `unknown note "${bullet.label}". Use ${allowed.join(", ")}.`);
  }
  if (!bullet.value) fail(lineNo, `"${bullet.label}" is empty.`);
  return bullet.value;
}

function uniqueTitles(titles: string[], group: string): void {
  const seen = new Set<string>();
  for (const title of titles) {
    const key = title.toLocaleLowerCase();
    if (seen.has(key)) {
      throw new CatalogError(`"${title}" is listed twice under ${group}.`);
    }
    seen.add(key);
  }
}

function youtubeAt(
  url: string,
  lineNo: number,
): { id: string; startSeconds: number | null } {
  try {
    return readYouTube(url);
  } catch (error) {
    if (error instanceof CatalogError) fail(lineNo, error.message);
    throw error;
  }
}

export function parseCatalog(source: string): Catalog {
  const lines = source.split(/\r?\n/);
  let section: Section | null = null;
  let musicGroup: "profile" | "tracks" = "profile";
  let filmGroup: "films" | "dictionary" = "films";
  const seen = new Set<Section>();
  let sawDictionary = false;

  const site = { name: "", role: "", email: "" };
  const social = { youtube: "", instagram: "", bandcamp: "", spotify: "" };
  let musicBandcamp = "";
  let musicSpotify = "";
  const tracks: Track[] = [];
  const films: Film[] = [];
  const dictionary: DictionaryPiece[] = [];
  const collaborations: Collaboration[] = [];
  const aboutLines: string[] = [];
  let aboutPhoto: string | undefined;
  let last: Last | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      if (section === "about") aboutLines.push("");
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (heading) {
      const level = heading[1]?.length ?? 0;
      const title = heading[2]?.trim() ?? "";
      if (level === 1) {
        section = null;
        continue;
      }
      if (level === 2) {
        const next = SECTION_HEADINGS[title];
        if (!next) {
          fail(
            lineNo,
            `unknown section "${title}". Use Site, Social, Music, Films, Collaborations, or About.`,
          );
        }
        section = next;
        seen.add(next);
        last = null;
        if (next === "music") musicGroup = "profile";
        if (next === "films") filmGroup = "films";
        continue;
      }
      if (section === "music") {
        musicGroup = "tracks";
        last = null;
        continue;
      }
      if (section === "films") {
        if (title !== "Chinese Dictionary") {
          fail(lineNo, 'this group should be named "Chinese Dictionary".');
        }
        filmGroup = "dictionary";
        sawDictionary = true;
        last = null;
        continue;
      }
      fail(lineNo, `unexpected heading "${title}".`);
    }

    // The instructions at the top of the file are not content.
    if (section === null) continue;

    if (section === "about" && !line.trim().startsWith("-")) {
      aboutLines.push(line.trim());
      continue;
    }

    if (!line.trim().startsWith("-")) {
      fail(
        lineNo,
        "could not read this line. Works are bullets. Sentences belong under About.",
      );
    }

    const bullet = readBullet(line, lineNo);
    requireHttps(bullet, lineNo);

    if (bullet.indent > 0) {
      if (!last) fail(lineNo, "this note needs a work bullet directly above it.");
      if (last.kind === "track") {
        last.item.summary = noteValue(bullet, ["summary"], lineNo);
      } else if (last.kind === "film" || last.kind === "dictionary") {
        const value = noteValue(bullet, ["summary", "credits"], lineNo);
        if (bullet.label === "summary") last.item.summary = value;
        else last.item.credits = value;
      } else {
        const value = noteValue(bullet, ["role", "project", "year"], lineNo);
        if (bullet.label === "role") last.item.role = value;
        else if (bullet.label === "project") last.item.project = value;
        else last.item.year = value;
      }
      continue;
    }

    if (section === "site") {
      if (bullet.isUrl) fail(lineNo, `${bullet.label} should be words, not a link.`);
      if (!bullet.value) fail(lineNo, `${bullet.label} is empty.`);
      if (bullet.label === "Name") site.name = bullet.value;
      else if (bullet.label === "Role") site.role = bullet.value;
      else if (bullet.label === "Email") site.email = bullet.value;
      else
        fail(lineNo, `unknown Site field "${bullet.label}". Use Name, Role, or Email.`);
      continue;
    }

    if (section === "social") {
      if (bullet.value && !bullet.isUrl) {
        fail(lineNo, `${bullet.label} needs an https link, or leave it blank.`);
      }
      const value = bullet.value ? stripSpotifyShare(bullet.value) : "";
      if (bullet.label === "YouTube") social.youtube = value;
      else if (bullet.label === "Instagram") social.instagram = value;
      else if (bullet.label === "Bandcamp") social.bandcamp = value;
      else if (bullet.label === "Spotify") social.spotify = value;
      else {
        fail(
          lineNo,
          `unknown social "${bullet.label}". Use YouTube, Instagram, Bandcamp, or Spotify.`,
        );
      }
      continue;
    }

    if (section === "music" && musicGroup === "profile") {
      if (!bullet.isUrl) fail(lineNo, `${bullet.label} needs an https link.`);
      if (bullet.label === "Bandcamp") musicBandcamp = bullet.value;
      else if (bullet.label === "Spotify")
        musicSpotify = stripSpotifyShare(bullet.value);
      else fail(lineNo, "under Music, list Bandcamp and Spotify before the tracks.");
      continue;
    }

    if (section === "music" && musicGroup === "tracks") {
      if (!bullet.isUrl) fail(lineNo, "a track needs a YouTube link.");
      const video = youtubeAt(bullet.value, lineNo);
      const track: Track = {
        title: bullet.label,
        url: bullet.value,
        youtubeId: video.id,
      };
      tracks.push(track);
      last = { kind: "track", item: track };
      continue;
    }

    if (section === "films" && filmGroup === "films") {
      if (!bullet.isUrl) fail(lineNo, "a film needs a YouTube link.");
      const video = youtubeAt(bullet.value, lineNo);
      const film: Film = {
        title: bullet.label,
        url: bullet.value,
        youtubeId: video.id,
        startSeconds: video.startSeconds,
      };
      films.push(film);
      last = { kind: "film", item: film };
      continue;
    }

    if (section === "films" && filmGroup === "dictionary") {
      if (!bullet.isUrl)
        fail(lineNo, "a Chinese Dictionary piece needs an Instagram link.");
      try {
        assertInstagramPost(bullet.value);
      } catch (error) {
        if (error instanceof CatalogError) fail(lineNo, error.message);
        throw error;
      }
      const piece: DictionaryPiece = { title: bullet.label, url: bullet.value };
      dictionary.push(piece);
      last = { kind: "dictionary", item: piece };
      continue;
    }

    if (section === "collaborations") {
      if (!bullet.isUrl) fail(lineNo, "add an https link after the name.");
      const collaboration: Collaboration = { name: bullet.label, url: bullet.value };
      collaborations.push(collaboration);
      last = { kind: "collaboration", item: collaboration };
      continue;
    }

    if (section === "about") {
      if (bullet.label !== "Photo") {
        fail(
          lineNo,
          'the only bullet under About is "Photo: public/images/about.jpg".',
        );
      }
      if (!bullet.value || bullet.isUrl) {
        fail(lineNo, "Photo needs a file path like public/images/about.jpg.");
      }
      if (
        bullet.value.includes("..") ||
        bullet.value.startsWith("/") ||
        bullet.value.includes("://")
      ) {
        fail(lineNo, "Photo path should look like public/images/about.jpg.");
      }
      aboutPhoto = bullet.value;
    }
  }

  for (const [heading, key] of Object.entries(SECTION_HEADINGS)) {
    if (!seen.has(key)) {
      throw new CatalogError(`Missing the "## ${heading}" heading.`);
    }
  }
  if (!sawDictionary) {
    throw new CatalogError('Missing the "### Chinese Dictionary" heading under Films.');
  }

  uniqueTitles(
    tracks.map((track) => track.title),
    "Music",
  );
  uniqueTitles(
    films.map((film) => film.title),
    "Films",
  );
  uniqueTitles(
    dictionary.map((piece) => piece.title),
    "Chinese Dictionary",
  );
  uniqueTitles(
    collaborations.map((collaboration) => collaboration.name),
    "Collaborations",
  );

  if (!/^aryk\b/i.test(films[0]?.title ?? "")) {
    throw new CatalogError("The first film must be Aryk.");
  }
  if (films[0]?.startSeconds === null || films[0]?.startSeconds === undefined) {
    throw new CatalogError("Aryk's YouTube link needs a start time, such as t=1744s.");
  }

  const about = aboutLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const draft = {
    site,
    social,
    music: { bandcamp: musicBandcamp, spotify: musicSpotify, tracks },
    films,
    dictionary,
    collaborations,
    about,
    ...(aboutPhoto ? { aboutPhoto } : {}),
  };

  const parsed = CatalogShape.safeParse(draft);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" ");
    throw new CatalogError(message);
  }
  return parsed.data;
}

export function loadCatalog(root = process.cwd()): Catalog {
  const filePath = path.join(root, "references", "links.md");
  let source: string;
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch {
    throw new CatalogError("Could not find references/links.md in the project folder.");
  }

  let catalog: Catalog;
  try {
    catalog = parseCatalog(source);
  } catch (error) {
    if (error instanceof CatalogError) {
      throw new CatalogError(`references/links.md — ${error.message}`);
    }
    throw error;
  }

  if (catalog.aboutPhoto) {
    const absolute = path.join(root, catalog.aboutPhoto);
    if (!fs.existsSync(absolute)) {
      throw new CatalogError(
        `references/links.md — photo file not found: ${catalog.aboutPhoto}`,
      );
    }
  }
  return catalog;
}

export function publicSrc(repoPath: string): string {
  if (repoPath.startsWith("public/")) return `/${repoPath.slice("public/".length)}`;
  return `/${repoPath}`;
}

export function socialLinks(catalog: Catalog): { label: string; href: string }[] {
  const { youtube, instagram, bandcamp, spotify } = catalog.social;
  return [
    { label: "YouTube", href: youtube },
    { label: "Instagram", href: instagram },
    { label: "Bandcamp", href: bandcamp },
    { label: "Spotify", href: spotify },
  ].filter((item) => item.href !== "");
}
