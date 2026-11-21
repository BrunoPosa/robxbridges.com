// Asks Bandcamp whether every player in references/links.md still exists.
// Run it with: npm run check-players
//
// GitHub runs it once a week (see .github/workflows/ci.yml). If a release has
// been taken down on Bandcamp, the run fails and GitHub sends an email, so
// someone can fix or remove that entry. The site itself already shows a gray
// "Not available right now :(" panel for it, so nothing looks broken meanwhile.
//
// If Bandcamp cannot be reached, that is only a warning, never a failure.
import { bandcampPlayers, loadCatalog } from "../src/data/catalog.ts";
import { playerStatus } from "../src/data/bandcamp.ts";

const results = await Promise.all(
  bandcampPlayers(loadCatalog()).map(async ({ label, player }) => ({
    label,
    playerId: player.playerId,
    status: await playerStatus(player),
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
