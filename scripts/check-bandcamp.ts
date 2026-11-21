// Tests for src/data/bandcamp.ts: the player's address and height, and how a
// gone release is told apart from a slow Bandcamp. No real Bandcamp is asked:
// each test hands in its own stand-in fetch.
import assert from "node:assert/strict";
import { test } from "node:test";
import { playerStatus, playerView, type Player } from "../src/data/bandcamp.ts";

const album: Player = {
  kind: "album",
  playerId: "283143371",
  url: "https://robbridgesmusic.bandcamp.com/album/luna-ep",
  title: "LUNA EP",
  rows: 5,
};
const single: Player = {
  kind: "track",
  playerId: "797509581",
  url: "https://robbridgesmusic.bandcamp.com/track/i-believe-now",
  title: "i believe now",
  rows: 0,
};

// A fetch that answers every request with this page, and counts the asks.
function bandcampSays(html: string, status = 200) {
  const asked: string[] = [];
  const fetchPage = (async (input: string | URL | Request) => {
    asked.push(String(input));
    return new Response(html, { status });
  }) as typeof fetch;
  return { fetchPage, asked };
}

const livePage = '<div id="player" data-player-data="{&quot;id&quot;:1}"></div>';
const gonePage = "<p>Sorry, this track or album is not available.</p>";

test("an album with tracks shows its list, a single does not", async () => {
  const { fetchPage } = bandcampSays(livePage);
  const albumView = await playerView(album, fetchPage);
  assert.equal(
    albumView.src,
    "https://bandcamp.com/EmbeddedPlayer/album=283143371/size=large/bgcol=303030/linkcol=ece7dc/tracklist=true/artwork=none/transparent=true/",
  );
  assert.equal(albumView.height, 136 + 5 * 38);
  assert.equal(albumView.gone, false);

  const singleView = await playerView(single, fetchPage);
  assert.match(singleView.src, /\/track=797509581\/.*tracklist=false\//);
  assert.equal(singleView.height, 120);
});

test("a release Bandcamp has taken down is gone", async () => {
  const { fetchPage, asked } = bandcampSays(gonePage);
  assert.equal(await playerStatus(album, fetchPage), "gone");
  assert.equal((await playerView(album, fetchPage)).gone, true);
  assert.deepEqual(asked, ["https://bandcamp.com/EmbeddedPlayer/album=283143371/"]);
});

test("an error page or no answer never counts as gone", async () => {
  assert.equal(
    await playerStatus(album, bandcampSays(gonePage, 503).fetchPage),
    "unknown",
  );
  const offline = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  assert.equal(await playerStatus(album, offline), "unknown");
  assert.equal((await playerView(album, offline)).gone, false);
});

test("each player is asked about once per build", async () => {
  const { fetchPage, asked } = bandcampSays(livePage);
  await Promise.all([
    playerView(album, fetchPage),
    playerView(album, fetchPage),
    playerStatus(single, fetchPage),
  ]);
  assert.equal(asked.length, 2);
});
