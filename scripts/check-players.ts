// Asks Bandcamp whether every player in references/links.md still exists.
// Run it with: npm run check-players
//
// GitHub runs it once a week (see .github/workflows/ci.yml). If a release has
// been taken down on Bandcamp, the run fails and GitHub sends an email, so
// someone can fix or remove that entry. The site itself already shows a gray
// "Not available right now" panel for it, so nothing looks broken meanwhile.
//
// If Bandcamp cannot be reached, that is only a warning, never a failure.
import { loadCatalog } from "../src/data/catalog.ts";
import { playerStatus } from "../src/data/bandcamp-check.ts";

type Player = { label: string; kind: "album" | "track"; playerId: string };

const catalog = loadCatalog();
const players: Player[] = [];

for (const album of catalog.music.albums) {
  players.push({
    label: `Music: ${album.title}`,
    kind: album.kind,
    playerId: album.playerId,
  });
  for (const track of album.tracks) {
    if (track.playerId && track.playerId !== album.playerId) {
      players.push({
        label: `Music: ${album.title} / ${track.title}`,
        kind: "track",
        playerId: track.playerId,
      });
    }
  }
}
for (const collaboration of catalog.collaborations) {
  if (collaboration.playerId) {
    players.push({
      label: `Collaborations: ${collaboration.project ?? collaboration.name}`,
      kind: "track",
      playerId: collaboration.playerId,
    });
  }
}

const results = await Promise.all(
  players.map(async (player) => ({
    ...player,
    status: await playerStatus(player.kind, player.playerId),
  })),
);

const gone = results.filter((result) => result.status === "gone");
const unknown = results.filter((result) => result.status === "unknown");

for (const result of unknown) {
  console.warn(
    `Could not reach Bandcamp for ${result.label} (player ${result.playerId}).`,
  );
}
for (const result of gone) {
  console.error(
    `Gone from Bandcamp: ${result.label} (player ${result.playerId}). Fix or remove it in references/links.md.`,
  );
}
console.log(
  `${results.length} players checked: ${results.length - gone.length - unknown.length} fine, ${gone.length} gone, ${unknown.length} not reached.`,
);
if (gone.length > 0) process.exit(1);
