// Everything about Bandcamp's own player, in one place: its web address, its
// height, and whether Bandcamp still has the release.
//
// The catalog (src/data/catalog.ts) gives each release, track, and
// collaboration a Player. Pages turn a Player into a PlayerView with
// playerView(), then draw it.
//
// Gone releases: a track or album taken down on Bandcamp still loads
// Bandcamp's player, but it shows a white "Sorry, this track or album is not
// available" box. A web page cannot look inside Bandcamp's player, so the page
// cannot tell. The build can: Bandcamp's player page carries the release's
// details in a data-player-data attribute, and a removed release has none.
// If Bandcamp cannot be reached, the player counts as fine, so a slow Bandcamp
// never breaks or blocks a publish.

// One Bandcamp player, as written in references/links.md.
export type Player = {
  // "album" plays a whole release; "track" plays one track or a single.
  kind: "album" | "track";
  // The number after album= or track= in Bandcamp's embed code.
  playerId: string;
  // The Bandcamp page to offer when the player cannot show.
  url: string;
  // The name read out to screen readers.
  title: string;
  // Track rows in the player's list. 0 means no list.
  rows: number;
};

// What a page needs to draw one player.
export type PlayerView = Player & {
  src: string;
  height: number;
  // True only when Bandcamp clearly says the release is gone.
  gone: boolean;
};

export type PlayerStatus = "ok" | "gone" | "unknown";

// Bandcamp ignores a custom dark background, so the player uses its own gray.
const playerGray = "303030";

function playerSrc(player: Player): string {
  const tracklist = player.rows > 0;
  return `https://bandcamp.com/EmbeddedPlayer/${player.kind}=${player.playerId}/size=large/bgcol=${playerGray}/linkcol=ece7dc/tracklist=${tracklist}/artwork=none/transparent=true/`;
}

// The transport is about 120px and each track row about 32px. The extra pixels
// keep the last duration inside the rounded card, so the frame never scrolls.
function playerHeight(player: Player): number {
  return player.rows > 0 ? 136 + player.rows * 38 : 120;
}

// One answer per player per build, shared by every page that asks. Kept apart
// for each fetch, so tests with a stand-in fetch never see real answers.
const answers = new WeakMap<typeof fetch, Map<string, Promise<PlayerStatus>>>();

async function ask(url: string, fetchPage: typeof fetch): Promise<PlayerStatus> {
  try {
    const response = await fetchPage(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return "unknown";
    const html = await response.text();
    return html.includes("data-player-data=") ? "ok" : "gone";
  } catch {
    return "unknown";
  }
}

// Asks Bandcamp whether the player still exists. Tests pass their own fetch.
export function playerStatus(
  player: Player,
  fetchPage: typeof fetch = fetch,
): Promise<PlayerStatus> {
  const url = `https://bandcamp.com/EmbeddedPlayer/${player.kind}=${player.playerId}/`;
  let cache = answers.get(fetchPage);
  if (!cache) {
    cache = new Map();
    answers.set(fetchPage, cache);
  }
  let answer = cache.get(url);
  if (!answer) {
    answer = ask(url, fetchPage);
    cache.set(url, answer);
  }
  return answer;
}

export async function playerView(
  player: Player,
  fetchPage: typeof fetch = fetch,
): Promise<PlayerView> {
  const status = await playerStatus(player, fetchPage);
  return {
    ...player,
    src: playerSrc(player),
    height: playerHeight(player),
    gone: status === "gone",
  };
}
