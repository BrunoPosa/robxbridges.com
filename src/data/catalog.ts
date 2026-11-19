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
  playerId: string;
  url?: string;
  youtubeId?: string;
  summary?: string;
};

export type Album = {
  title: string;
  url: string;
  playerId: string;
  // "album" embeds with album=; a single embeds with track=.
  kind: "album" | "track";
  cover: string;
  credit?: string;
  tracks: Track[];
};

export type Film = {
  title: string;
  url: string;
  youtubeId: string;
  startSeconds: number | null;
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
  // The Bandcamp track number. With it, the row gets a player.
  playerId?: string;
};

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
  dictionaryInfo: { year?: string; summary?: string };
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
  | { kind: "film"; item: Film }
  | { kind: "dictionary"; item: DictionaryPiece }
  | { kind: "collaboration"; item: Collaboration };

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
          playerId: z.string().regex(/^\d{6,12}$/),
          kind: z.enum(["album", "track"]),
          cover: z.string().min(1),
          credit: z.string().min(1).optional(),
          tracks: z.array(
            z.object({
              title: z.string().min(1),
              playerId: z.string().regex(/^\d{6,12}$/),
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
        youtubeId: z.string().regex(YOUTUBE_ID),
        startSeconds: z.number().int().nonnegative().nullable(),
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
      playerId: z
        .string()
        .regex(/^\d{6,12}$/)
        .optional(),
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
    tracks: Track[];
  } | null = null;
  let openTrack: OpenTrack | null = null;
  const films: Film[] = [];

  function closeTrack(): void {
    if (!openTrack) return;
    const current = openTrack;
    const playerId = current.playerId;
    if (!playerId) fail(current.lineNo, `${current.title} needs a player number.`);
    if (!draft) fail(current.lineNo, `${current.title} needs a release heading.`);
    const track: Track = {
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
    albums.push({
      title: draft.title,
      url: draft.url,
      playerId: draft.playerId,
      kind: draft.kind,
      cover: draft.cover,
      ...(draft.credit ? { credit: draft.credit } : {}),
      tracks: draft.tracks,
    });
    draft = null;
  }
  const dictionary: DictionaryPiece[] = [];
  const dictionaryInfo: { year?: string; summary?: string } = {};
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
        const value = noteValue(bullet, ["year", "summary", "credits"], lineNo);
        if (bullet.label === "year") last.item.year = value;
        else if (bullet.label === "summary") last.item.summary = value;
        else last.item.credits = value;
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

  if (!/^aryk\b/i.test(films[0]?.title ?? "")) {
    throw new CatalogError("The first film must be Aryk.");
  }
  if (films[0]?.startSeconds === null || films[0]?.startSeconds === undefined) {
    throw new CatalogError("Aryk's YouTube link needs a start time, such as t=1744s.");
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
    collaborations,
    about,
    ...(aboutPhoto ? { aboutPhoto } : {}),
  };

  const parsed = CatalogShape.safeParse(catalogDraft);
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

// The address of Bandcamp's own player for one album or track. The music page
// and the collaborations page both use it, so the players look the same.
// Bandcamp ignores a custom dark background, so bgcol is its own gray.
export const bandcampPlayerGray = "303030";

export function bandcampPlayerSrc(
  kind: "album" | "track",
  playerId: string,
  tracklist: boolean,
): string {
  return `https://bandcamp.com/EmbeddedPlayer/${kind}=${playerId}/size=large/bgcol=${bandcampPlayerGray}/linkcol=ece7dc/tracklist=${tracklist}/artwork=none/transparent=true/`;
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
