// Reads references/links.md — the file Rob edits — and checks that every
// work has the kind of link the page expects. Pages render this data.
// They do not keep their own copy of the titles.

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Player } from "./bandcamp";

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
// The second code in an unlisted Vimeo link, as in vimeo.com/123456789/abc123def0.
const VIMEO_HASH = /^[0-9a-f]{6,20}$/;
// Film stills kept on this site (Vimeo gives no still from the link alone).
const FILM_POSTER = /^public\/images\/films\/[a-z0-9-]+\.jpg$/;

export type Track = {
  title: string;
  // Not drawn on the site. The weekly check asks Bandcamp about it, so a track
  // pulled from an album is noticed.
  player: Player;
  url?: string;
  youtubeId?: string;
  summary?: string;
};

export type Album = {
  title: string;
  url: string;
  // "album" for a release with tracks; "track" for a single.
  kind: "album" | "track";
  player: Player;
  cover: string;
  credit?: string;
  tracks: Track[];
};

export type Film = {
  title: string;
  url: string;
  // The site that plays the film, read from its link.
  host: "youtube" | "vimeo";
  videoId: string;
  // Only for an unlisted Vimeo video: the second code in its link.
  vimeoHash?: string;
  startSeconds: number | null;
  // A still in public/images/films. A Vimeo film needs one. A YouTube film
  // uses YouTube's own still unless this is set.
  poster?: string;
  year?: string;
  summary?: string;
  credits?: string;
};

export type DictionaryPiece = {
  title: string;
  url: string;
  // A still in public/films, shown before the video plays.
  poster: string;
  // The clip itself, an MP4 in public/films (made by scripts/encode-video.sh).
  video: string;
  summary?: string;
  credits?: string;
};

export type Collaboration = {
  name: string;
  url: string;
  role?: string;
  project?: string;
  year?: string;
  instagram?: string;
  // A square cover in public/images/collabs/, shown beside the name.
  cover?: string;
  // From the Bandcamp track number. With it, the row gets a player.
  player?: Player;
};

// A collaboration while its notes are still being read.
type CollaborationDraft = Omit<Collaboration, "player"> & { playerId?: string };
// A track while its release is still being read.
type TrackDraft = Omit<Track, "player"> & { playerId: string };

export type Catalog = {
  site: { name: string; role: string; email: string };
  social: {
    youtube: string;
    instagram: string;
    bandcamp: string;
    spotify: string;
  };
  music: { bandcamp: string; spotify: string; albums: Album[] };
  films: Film[];
  dictionary: DictionaryPiece[];
  // One line about the whole Chinese Dictionary group, shown above its pieces.
  dictionaryInfo: { year?: string; summary?: string; instagram?: string };
  collaborations: Collaboration[];
  about: string;
  // The bio split into paragraphs, each a run of plain words and links.
  aboutParagraphs: AboutPiece[][];
  aboutPhoto?: string;
};

// One run of the bio. With href, it is a link: to a work on this site, or
// (external) to another site.
export type AboutPiece = { text: string; href?: string; external?: boolean };

type Section = "site" | "social" | "music" | "films" | "collaborations" | "about";

type Bullet = {
  indent: number;
  label: string;
  value: string;
  isUrl: boolean;
};

type Last =
  | { kind: "film"; item: Film }
  | { kind: "dictionary"; item: DictionaryPiece }
  | { kind: "collaboration"; item: CollaborationDraft };

type OpenTrack = {
  title: string;
  lineNo: number;
  url?: string;
  youtubeId?: string;
  summary?: string;
  playerId?: string;
};

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

const playerShape = z.object({
  kind: z.enum(["album", "track"]),
  playerId: z.string().regex(/^\d{6,12}$/),
  url: httpsUrl,
  title: z.string().min(1),
  rows: z.number().int().nonnegative(),
});

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
    albums: z
      .array(
        z.object({
          title: z.string().min(1),
          url: httpsUrl,
          kind: z.enum(["album", "track"]),
          player: playerShape,
          cover: z.string().min(1),
          credit: z.string().min(1).optional(),
          tracks: z.array(
            z.object({
              title: z.string().min(1),
              player: playerShape,
              url: httpsUrl.optional(),
              youtubeId: z.string().regex(YOUTUBE_ID).optional(),
              summary: z.string().min(1).optional(),
            }),
          ),
        }),
      )
      .min(1, "Add at least one release under Music."),
  }),
  films: z
    .array(
      z.object({
        title: z.string().min(1),
        url: httpsUrl,
        host: z.enum(["youtube", "vimeo"]),
        videoId: z.string().min(1),
        vimeoHash: z.string().regex(VIMEO_HASH).optional(),
        startSeconds: z.number().int().nonnegative().nullable(),
        poster: z.string().regex(FILM_POSTER).optional(),
        year: z.string().min(1).optional(),
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
        poster: z.string().regex(/^public\/films\/[a-z0-9-]+\.jpg$/),
        video: z.string().regex(/^public\/films\/[a-z0-9-]+\.mp4$/),
        summary: z.string().min(1).optional(),
        credits: z.string().min(1).optional(),
      }),
    )
    .min(1, "Add at least one Chinese Dictionary piece."),
  dictionaryInfo: z.object({
    year: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
    instagram: httpsUrl.optional(),
  }),
  collaborations: z.array(
    z.object({
      name: z.string().min(1),
      url: httpsUrl,
      role: z.string().min(1).optional(),
      project: z.string().min(1).optional(),
      year: z.string().min(1).optional(),
      instagram: httpsUrl.optional(),
      cover: z.string().min(1).optional(),
      player: playerShape.optional(),
    }),
  ),
  about: z.string(),
  aboutParagraphs: z.array(
    z.array(
      z.object({
        text: z.string().min(1),
        href: z.string().min(1).optional(),
        external: z.boolean().optional(),
      }),
    ),
  ),
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

// A start time such as 1744, 1744s, or 29m4s, in seconds.
function readStartTime(raw: string, url: string): number {
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
  if (!raw || !match) {
    throw new CatalogError(`The start time in ${url} needs to look like t=1744s.`);
  }
  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

// Reads vimeo.com/123456789, vimeo.com/123456789/abc123 (an unlisted video),
// or player.vimeo.com/video/123456789?h=abc123. Extra bits after "?" are fine.
// A start time goes at the end, as #t=90s.
export function readVimeo(url: string): {
  id: string;
  hash?: string;
  startSeconds: number | null;
} {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CatalogError(`This is not a usable link: ${url}`);
  }

  const host = parsed.hostname.replace(/^www\./, "");
  const parts = parsed.pathname.split("/").filter(Boolean);
  let id = "";
  let hash: string | undefined;
  if (host === "vimeo.com") {
    id = parts[0] ?? "";
    hash = parts[1];
  } else if (host === "player.vimeo.com" && parts[0] === "video") {
    id = parts[1] ?? "";
    hash = parsed.searchParams.get("h") ?? undefined;
  } else {
    throw new CatalogError(`Expected a Vimeo link: ${url}`);
  }

  if (!VIMEO_ID.test(id)) {
    throw new CatalogError(`Could not find the Vimeo video number in ${url}`);
  }
  if (hash !== undefined && !VIMEO_HASH.test(hash)) {
    throw new CatalogError(`The part after the video number in ${url} looks wrong.`);
  }

  const raw = new URLSearchParams(parsed.hash.slice(1)).get("t");
  const startSeconds = raw === null ? null : readStartTime(raw, url);
  return { id, ...(hash ? { hash } : {}), startSeconds };
}

// A film link, from YouTube or Vimeo.
function readFilmVideo(url: string): Pick<Film, "host" | "videoId" | "vimeoHash" | "startSeconds"> {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      throw new CatalogError(`This is not a usable link: ${url}`);
    }
  })();
  if (/(^|\.)vimeo\.com$/.test(host)) {
    const video = readVimeo(url);
    return {
      host: "vimeo",
      videoId: video.id,
      ...(video.hash ? { vimeoHash: video.hash } : {}),
      startSeconds: video.startSeconds,
    };
  }
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) {
    const video = readYouTube(url);
    return { host: "youtube", videoId: video.id, startSeconds: video.startSeconds };
  }
  throw new CatalogError(`A film needs a YouTube or Vimeo link: ${url}`);
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

// A profile or post on Instagram, used beside a collaboration.
function assertInstagram(url: string): void {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // Reported below with the same message as a wrong site.
  }
  if (host !== "instagram.com") {
    throw new CatalogError(`Expected an Instagram link: ${url}`);
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

function localFile(value: string, lineNo: number, field: string): string {
  if (value.includes("..") || value.startsWith("/") || value.includes("://")) {
    fail(lineNo, `${field} path should look like public/images/cover.jpg.`);
  }
  return value;
}

// The still for a Chinese Dictionary piece.
function posterFile(value: string, lineNo: number): string {
  const filePath = localFile(value, lineNo, "poster");
  if (!/^public\/films\/[a-z0-9-]+\.jpg$/.test(filePath)) {
    fail(lineNo, "poster needs a path like public/films/flow.jpg.");
  }
  return filePath;
}

// The still for a film, shown before it plays.
function filmPosterFile(value: string, lineNo: number): string {
  const filePath = localFile(value, lineNo, "poster");
  if (!FILM_POSTER.test(filePath)) {
    fail(lineNo, "poster needs a path like public/images/films/aryk.jpg.");
  }
  return filePath;
}

// The clip for a Chinese Dictionary piece.
function videoFile(value: string, lineNo: number): string {
  const filePath = localFile(value, lineNo, "video");
  if (!/^public\/films\/[a-z0-9-]+\.mp4$/.test(filePath)) {
    fail(lineNo, "video needs a path like public/films/flow.mp4.");
  }
  return filePath;
}

// A collaboration cover.
function collabCoverFile(value: string, lineNo: number): string {
  const filePath = localFile(value, lineNo, "cover");
  if (!/^public\/images\/collabs\/[a-z0-9-]+\.jpg$/.test(filePath)) {
    fail(lineNo, "cover needs a path like public/images/collabs/2-disrupt.jpg.");
  }
  return filePath;
}

function releaseKind(url: string, lineNo: number): "album" | "track" {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    fail(lineNo, "Album needs a Bandcamp link.");
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host.endsWith("bandcamp.com") && /^\/album\/[^/]+\/?$/.test(parsed.pathname)) {
    return "album";
  }
  if (host.endsWith("bandcamp.com") && /^\/track\/[^/]+\/?$/.test(parsed.pathname)) {
    return "track";
  }
  fail(
    lineNo,
    "Album needs a Bandcamp album or track link, like https://robbridgesmusic.bandcamp.com/album/luna-ep.",
  );
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

// Two titles that differ only in punctuation, such as "3.14" and "3-14",
// would share one web address, so a link could land on the wrong one.
function uniqueAddresses(titles: string[], group: string): void {
  const seen = new Map<string, string>();
  for (const title of titles) {
    const slug = slugify(title);
    const other = seen.get(slug);
    if (other !== undefined) {
      throw new CatalogError(
        `"${other}" and "${title}" under ${group} are too alike. Change one title a little.`,
      );
    }
    seen.set(slug, title);
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

type ReleaseLine =
  | {
      kind: "field";
      label: "Album" | "Player" | "Cover" | "Credit";
      value: string;
    }
  | { kind: "track"; title: string; url?: string };

function readReleaseLine(line: string, lineNo: number): ReleaseLine {
  const body = line.trim().slice(2).trim();
  const urlMatch = body.match(/^(.*):\s+(https?:\/\/\S+)\s*$/);
  if (urlMatch) {
    const title = urlMatch[1]?.trim() ?? "";
    const value = urlMatch[2] ?? "";
    if (!title) fail(lineNo, "add a title before the link.");
    if (title === "Bandcamp" || title === "Spotify") {
      fail(lineNo, "list Bandcamp and Spotify before the releases.");
    }
    if (
      title === "Album" ||
      title === "Player" ||
      title === "Cover" ||
      title === "Credit"
    ) {
      return { kind: "field", label: title, value };
    }
    return { kind: "track", title, url: value };
  }
  const field = body.match(/^(Album|Player|Cover|Credit):\s*(.*)$/);
  if (
    field?.[1] === "Album" ||
    field?.[1] === "Player" ||
    field?.[1] === "Cover" ||
    field?.[1] === "Credit"
  ) {
    return { kind: "field", label: field[1], value: (field[2] ?? "").trim() };
  }
  if (!body) fail(lineNo, "add a track title.");
  return { kind: "track", title: body };
}

export function parseCatalog(source: string): Catalog {
  const lines = source.split(/\r?\n/);
  let section: Section | null = null;
  let filmGroup: "films" | "dictionary" = "films";
  const seen = new Set<Section>();
  let sawDictionary = false;

  const site = { name: "", role: "", email: "" };
  const social = { youtube: "", instagram: "", bandcamp: "", spotify: "" };
  let musicBandcamp = "";
  let musicSpotify = "";
  const albums: Album[] = [];
  let draft: {
    title: string;
    lineNo: number;
    url: string;
    playerId: string;
    kind: "album" | "track";
    cover: string;
    credit: string;
    tracks: TrackDraft[];
  } | null = null;
  let openTrack: OpenTrack | null = null;
  const films: Film[] = [];

  function closeTrack(): void {
    if (!openTrack) return;
    const current = openTrack;
    const playerId = current.playerId;
    if (!playerId) fail(current.lineNo, `${current.title} needs a player number.`);
    if (!draft) fail(current.lineNo, `${current.title} needs a release heading.`);
    const track: TrackDraft = {
      title: current.title,
      playerId,
      ...(current.url && current.youtubeId
        ? { url: current.url, youtubeId: current.youtubeId }
        : {}),
      ...(current.summary ? { summary: current.summary } : {}),
    };
    draft.tracks.push(track);
    openTrack = null;
  }

  function flushRelease(): void {
    if (!draft) return;
    closeTrack();
    if (!draft.url) fail(draft.lineNo, `${draft.title} needs a Bandcamp link.`);
    if (!draft.playerId) fail(draft.lineNo, `${draft.title} needs a Player number.`);
    if (!draft.cover) fail(draft.lineNo, `${draft.title} needs a Cover file.`);
    uniqueTitles(
      draft.tracks.map((track) => track.title),
      draft.title,
    );
    const release = draft;
    albums.push({
      title: release.title,
      url: release.url,
      kind: release.kind,
      player: {
        kind: release.kind,
        playerId: release.playerId,
        url: release.url,
        title: release.title,
        // An album of two or more tracks shows its track list.
        rows:
          release.kind === "album" && release.tracks.length > 1
            ? release.tracks.length
            : 0,
      },
      cover: release.cover,
      ...(release.credit ? { credit: release.credit } : {}),
      tracks: release.tracks.map(({ playerId, ...track }) => ({
        ...track,
        player: {
          kind: "track" as const,
          playerId,
          url: release.url,
          title: track.title,
          rows: 0,
        },
      })),
    });
    draft = null;
  }
  const dictionary: DictionaryPiece[] = [];
  const dictionaryInfo: { year?: string; summary?: string; instagram?: string } = {};
  const collaborations: CollaborationDraft[] = [];
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
        if (section === "music") flushRelease();
        section = null;
        continue;
      }
      if (level === 2) {
        if (section === "music") flushRelease();
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
        if (next === "films") filmGroup = "films";
        continue;
      }
      if (section === "music") {
        flushRelease();
        last = null;
        draft = {
          title,
          lineNo,
          url: "",
          playerId: "",
          kind: "album",
          cover: "",
          credit: "",
          tracks: [],
        };
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

    if (section === "music") {
      const indent = line.match(/^ */)?.[0].length ?? 0;
      if (indent > 0) {
        const bullet = readBullet(line, lineNo);
        requireHttps(bullet, lineNo);
        if (!openTrack) fail(lineNo, "this note needs a track directly above it.");
        const value = noteValue(bullet, ["summary", "player"], lineNo);
        if (bullet.label === "summary") openTrack.summary = value;
        else if (!/^\d{6,12}$/.test(value)) {
          fail(lineNo, "player needs the Bandcamp track number.");
        } else openTrack.playerId = value;
        continue;
      }
      if (!draft) {
        const bullet = readBullet(line, lineNo);
        requireHttps(bullet, lineNo);
        if (!bullet.isUrl) fail(lineNo, `${bullet.label} needs an https link.`);
        if (bullet.label === "Bandcamp") musicBandcamp = bullet.value;
        else if (bullet.label === "Spotify")
          musicSpotify = stripSpotifyShare(bullet.value);
        else {
          fail(
            lineNo,
            "under Music, list Bandcamp and Spotify, then one heading per release.",
          );
        }
        continue;
      }
      const item = readReleaseLine(line, lineNo);
      if (item.kind === "field") {
        closeTrack();
        if (item.label === "Album") {
          if (!item.value.startsWith("https://")) {
            fail(lineNo, "Album needs a Bandcamp link.");
          }
          if (draft.url) fail(lineNo, "Album is already set.");
          draft.kind = releaseKind(item.value, lineNo);
          draft.url = item.value;
        } else if (item.label === "Player") {
          if (!/^\d{6,12}$/.test(item.value)) {
            fail(lineNo, "Player needs the number from Bandcamp, such as 283143371.");
          }
          if (draft.playerId) fail(lineNo, "Player is already set.");
          draft.playerId = item.value;
        } else if (item.label === "Cover") {
          if (!item.value || item.value.startsWith("https://")) {
            fail(
              lineNo,
              "Cover needs a file path like public/images/covers/luna-ep.jpg.",
            );
          }
          if (draft.cover) fail(lineNo, "Cover is already set.");
          draft.cover = localFile(item.value, lineNo, "Cover");
        } else {
          if (!item.value || item.value.startsWith("https://")) {
            fail(lineNo, "Credit should be a name, not a link.");
          }
          if (draft.credit) fail(lineNo, "Credit is already set.");
          draft.credit = item.value;
        }
        continue;
      }
      closeTrack();
      const opened: OpenTrack = { title: item.title, lineNo };
      if (item.url) {
        if (!item.url.startsWith("https://")) fail(lineNo, "use an https link.");
        const video = youtubeAt(item.url, lineNo);
        opened.url = item.url;
        opened.youtubeId = video.id;
      }
      openTrack = opened;
      continue;
    }

    const bullet = readBullet(line, lineNo);
    requireHttps(bullet, lineNo);

    if (bullet.indent > 0) {
      if (!last) fail(lineNo, "this note needs a work bullet directly above it.");
      if (last.kind === "film") {
        const value = noteValue(
          bullet,
          ["year", "summary", "credits", "poster"],
          lineNo,
        );
        if (bullet.label === "year") last.item.year = value;
        else if (bullet.label === "summary") last.item.summary = value;
        else if (bullet.label === "credits") last.item.credits = value;
        else {
          if (last.item.poster) fail(lineNo, "poster is already set.");
          last.item.poster = filmPosterFile(value, lineNo);
        }
      } else if (last.kind === "dictionary") {
        const value = noteValue(
          bullet,
          ["summary", "credits", "poster", "video"],
          lineNo,
        );
        if (bullet.label === "summary") last.item.summary = value;
        else if (bullet.label === "credits") last.item.credits = value;
        else if (bullet.label === "video") {
          if (last.item.video) fail(lineNo, "video is already set.");
          last.item.video = videoFile(value, lineNo);
        } else {
          if (last.item.poster) fail(lineNo, "poster is already set.");
          last.item.poster = posterFile(value, lineNo);
        }
      } else if (bullet.label === "instagram") {
        if (bullet.indent < 2) fail(lineNo, "indent notes with two spaces.");
        if (!bullet.isUrl) fail(lineNo, "instagram needs an https link.");
        try {
          assertInstagram(bullet.value);
        } catch (error) {
          if (error instanceof CatalogError) fail(lineNo, error.message);
          throw error;
        }
        last.item.instagram = bullet.value;
      } else {
        const value = noteValue(
          bullet,
          ["role", "project", "year", "cover", "player", "instagram"],
          lineNo,
        );
        if (bullet.label === "role") last.item.role = value;
        else if (bullet.label === "project") last.item.project = value;
        else if (bullet.label === "year") last.item.year = value;
        else if (bullet.label === "cover") {
          if (last.item.cover) fail(lineNo, "cover is already set.");
          last.item.cover = collabCoverFile(value, lineNo);
        } else {
          if (!/^\d{6,12}$/.test(value)) {
            fail(lineNo, "player is the number after track= in Bandcamp's embed code.");
          }
          last.item.playerId = value;
        }
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

    if (section === "films" && filmGroup === "films") {
      if (!bullet.isUrl) fail(lineNo, "a film needs a YouTube or Vimeo link.");
      let video: ReturnType<typeof readFilmVideo>;
      try {
        video = readFilmVideo(bullet.value);
      } catch (error) {
        if (error instanceof CatalogError) fail(lineNo, error.message);
        throw error;
      }
      const film: Film = { title: bullet.label, url: bullet.value, ...video };
      films.push(film);
      last = { kind: "film", item: film };
      continue;
    }

    if (section === "films" && filmGroup === "dictionary") {
      // "Year:" and "Summary:" describe the whole group. They come before the pieces.
      if (!bullet.isUrl && (bullet.label === "Year" || bullet.label === "Summary")) {
        if (dictionary.length > 0) {
          fail(lineNo, `put ${bullet.label} above the first Chinese Dictionary piece.`);
        }
        if (!bullet.value) fail(lineNo, `${bullet.label} is empty.`);
        if (bullet.label === "Year") dictionaryInfo.year = bullet.value;
        else dictionaryInfo.summary = bullet.value;
        continue;
      }
      // "Instagram:" is the post for the piece in the permanent installation
      // (Night, at Hong Kong airport), shown under the group's description.
      if (bullet.label === "Instagram") {
        if (dictionary.length > 0) {
          fail(lineNo, "put Instagram above the first Chinese Dictionary piece.");
        }
        try {
          assertInstagramPost(bullet.value);
        } catch (error) {
          if (error instanceof CatalogError) fail(lineNo, error.message);
          throw error;
        }
        dictionaryInfo.instagram = bullet.value;
        continue;
      }
      if (!bullet.isUrl)
        fail(lineNo, "a Chinese Dictionary piece needs an Instagram link.");
      try {
        assertInstagramPost(bullet.value);
      } catch (error) {
        if (error instanceof CatalogError) fail(lineNo, error.message);
        throw error;
      }
      const piece: DictionaryPiece = {
        title: bullet.label,
        url: bullet.value,
        poster: "",
        video: "",
      };
      dictionary.push(piece);
      last = { kind: "dictionary", item: piece };
      continue;
    }

    if (section === "collaborations") {
      if (!bullet.isUrl) fail(lineNo, "add an https link after the name.");
      const collaboration: CollaborationDraft = {
        name: bullet.label,
        url: bullet.value,
      };
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
      aboutPhoto = localFile(bullet.value, lineNo, "Photo");
    }
  }

  flushRelease();

  for (const [heading, key] of Object.entries(SECTION_HEADINGS)) {
    if (!seen.has(key)) {
      throw new CatalogError(`Missing the "## ${heading}" heading.`);
    }
  }
  if (!sawDictionary) {
    throw new CatalogError('Missing the "### Chinese Dictionary" heading under Films.');
  }

  uniqueTitles(
    albums.map((album) => album.title),
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

  uniqueAddresses([...films.map((film) => film.title), "Chinese Dictionary"], "Films");
  uniqueAddresses(
    albums.map((album) => album.title),
    "Music",
  );
  uniqueAddresses(
    collaborations.map((collaboration) => collaboration.project ?? collaboration.name),
    "Collaborations",
  );

  if (!/^aryk\b/i.test(films[0]?.title ?? "")) {
    throw new CatalogError("The first film must be Aryk.");
  }
  for (const film of films) {
    if (film.host === "vimeo" && !film.poster) {
      throw new CatalogError(
        `"${film.title}" is on Vimeo, so it needs a still. Under that film, add a line: poster: public/images/films/name.jpg`,
      );
    }
  }
  for (const piece of dictionary) {
    if (!piece.poster) {
      throw new CatalogError(
        `"${piece.title}" needs a still. Under that piece, add a line: poster: public/films/name.jpg`,
      );
    }
    if (!piece.video) {
      throw new CatalogError(
        `"${piece.title}" needs a video. Under that piece, add a line: video: public/films/name.mp4`,
      );
    }
  }

  const about = aboutLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const catalogDraft = {
    site,
    social,
    music: {
      bandcamp: musicBandcamp,
      spotify: musicSpotify,
      albums,
    },
    films,
    dictionary,
    dictionaryInfo,
    collaborations: collaborations.map(
      ({ playerId, ...collaboration }): Collaboration =>
        playerId
          ? {
              ...collaboration,
              player: {
                kind: "track",
                playerId,
                url: collaboration.url,
                title: collaboration.project ?? collaboration.name,
                rows: 0,
              },
            }
          : collaboration,
    ),
    about,
    aboutParagraphs: linkAbout(about, { albums, films, dictionary, collaborations }),
    ...(aboutPhoto ? { aboutPhoto } : {}),
  };

  const parsed = CatalogShape.safeParse(catalogDraft);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" ");
    throw new CatalogError(message);
  }
  return parsed.data;
}

// The web address name of a work, such as "aryk" for "Aryk!" or "luna-ep"
// for "LUNA EP". Pages use it as the id a link jumps to.
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "work";
}

// The pages a bio link can name directly, such as [music videos](Music).
const PAGES: Record<string, string> = {
  music: "/music",
  films: "/films",
  collaborations: "/collaborations",
};

// Where each work lives on the site, by its lowercase title.
function workAddresses(works: {
  albums: Album[];
  films: Film[];
  dictionary: DictionaryPiece[];
  collaborations: Collaboration[];
}): Map<string, string> {
  const addresses = new Map<string, string>();
  const add = (title: string, href: string) => {
    const key = title.trim().toLowerCase();
    if (!addresses.has(key)) addresses.set(key, href);
  };
  for (const film of works.films) add(film.title, `/films#${slugify(film.title)}`);
  add("Chinese Dictionary", "/films#chinese-dictionary");
  for (const piece of works.dictionary) add(piece.title, "/films#chinese-dictionary");
  for (const album of works.albums) {
    // "LUNA EP videos" (or a track that has a video) lands on the video
    // stills under the player, not the cover.
    const href = `/music#${slugify(album.title)}`;
    const videos = `${href}-videos`;
    add(album.title, href);
    if (album.tracks.some((track) => track.youtubeId))
      add(`${album.title} videos`, videos);
    for (const track of album.tracks) add(track.title, track.youtubeId ? videos : href);
  }
  for (const collaboration of works.collaborations) {
    const title = collaboration.project ?? collaboration.name;
    const href = `/collaborations#${slugify(title)}`;
    add(title, href);
    add(collaboration.name, href);
  }
  for (const [name, href] of Object.entries(PAGES)) add(name, href);
  return addresses;
}

// Turns the bio into paragraphs of words and links. In the bio:
//   [Aryk!]                          links to Aryk! on the Films page
//   [not/local](not/local with Kir)  shows "not/local", links to that work
//   [music videos](LUNA EP videos)   links to a release's video stills
//   [Straight8](https://...)         links to another site
// A name that matches no work stops the build, so a typo never ships.
function linkAbout(
  about: string,
  works: Parameters<typeof workAddresses>[0],
): AboutPiece[][] {
  const addresses = workAddresses(works);
  // The round brackets may hold a title with its own brackets, like "I: LUNA (156)".
  const link = /\[([^\]]+)\](?:\(((?:[^()]|\([^()]*\))+)\))?/g;
  return about
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const pieces: AboutPiece[] = [];
      let from = 0;
      for (const match of paragraph.matchAll(link)) {
        const text = (match[1] ?? "").trim();
        const target = (match[2] ?? text).trim();
        if (match.index > from)
          pieces.push({ text: paragraph.slice(from, match.index) });
        if (/^https:\/\//.test(target)) {
          pieces.push({ text, href: target, external: true });
        } else {
          const href = addresses.get(target.toLowerCase());
          if (!href) {
            throw new CatalogError(
              `About links to "${target}", but no film, release, track, collaboration, or page has that name. Check the spelling, or write it as [words](exact title).`,
            );
          }
          pieces.push({ text, href });
        }
        from = match.index + match[0].length;
      }
      if (from < paragraph.length) pieces.push({ text: paragraph.slice(from) });
      return pieces;
    });
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
  for (const album of catalog.music.albums) {
    const absolute = path.join(root, album.cover);
    if (!fs.existsSync(absolute)) {
      throw new CatalogError(
        `references/links.md — cover file not found: ${album.cover}`,
      );
    }
  }
  for (const collaboration of catalog.collaborations) {
    if (collaboration.cover && !fs.existsSync(path.join(root, collaboration.cover))) {
      throw new CatalogError(
        `references/links.md — cover file not found: ${collaboration.cover}`,
      );
    }
  }
  for (const film of catalog.films) {
    if (film.poster && !fs.existsSync(path.join(root, film.poster))) {
      throw new CatalogError(
        `references/links.md — poster file not found: ${film.poster}`,
      );
    }
  }
  for (const piece of catalog.dictionary) {
    if (!fs.existsSync(path.join(root, piece.poster))) {
      throw new CatalogError(
        `references/links.md — poster file not found: ${piece.poster}`,
      );
    }
    if (!fs.existsSync(path.join(root, piece.video))) {
      throw new CatalogError(
        `references/links.md — video file not found: ${piece.video}. Make it with scripts/encode-video.sh.`,
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

// Every Bandcamp player the site knows about, for the weekly check
// (scripts/check-players.ts). Each comes with a label naming where it is.
export function bandcampPlayers(catalog: Catalog): { label: string; player: Player }[] {
  const players: { label: string; player: Player }[] = [];
  for (const album of catalog.music.albums) {
    players.push({ label: `Music: ${album.title}`, player: album.player });
    for (const track of album.tracks) {
      if (track.player.playerId === album.player.playerId) continue;
      players.push({
        label: `Music: ${album.title} / ${track.title}`,
        player: track.player,
      });
    }
  }
  for (const collaboration of catalog.collaborations) {
    if (!collaboration.player) continue;
    players.push({
      label: `Collaborations: ${collaboration.player.title}`,
      player: collaboration.player,
    });
  }
  return players;
}
