// Asks Bandcamp, while the site is built, whether each player still exists.
//
// A track or album taken down on Bandcamp still loads Bandcamp's player, but
// it shows a white "Sorry, this track or album is not available" box. A web
// page cannot look inside Bandcamp's player, so the page cannot tell. The
// build can: Bandcamp's player page carries the release's details in a
// data-player-data attribute, and a removed release has none.
//
// A removed release gets the site's own gray panel instead of the player.
// If Bandcamp cannot be reached, every player counts as fine, so a slow
// Bandcamp never breaks or blocks a publish.

export type PlayerStatus = "ok" | "gone" | "unknown";

// One answer per player per build, shared by every page that asks.
const answers = new Map<string, Promise<PlayerStatus>>();

async function ask(url: string): Promise<PlayerStatus> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return "unknown";
    const html = await response.text();
    return html.includes("data-player-data=") ? "ok" : "gone";
  } catch {
    return "unknown";
  }
}

export function playerStatus(
  kind: "album" | "track",
  playerId: string,
): Promise<PlayerStatus> {
  const url = `https://bandcamp.com/EmbeddedPlayer/${kind}=${playerId}/`;
  let answer = answers.get(url);
  if (!answer) {
    answer = ask(url);
    answers.set(url, answer);
  }
  return answer;
}

// True only when Bandcamp clearly says the release is gone.
export async function isPlayerGone(
  kind: "album" | "track",
  playerId: string,
): Promise<boolean> {
  return (await playerStatus(kind, playerId)) === "gone";
}
