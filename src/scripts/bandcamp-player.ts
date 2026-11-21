// Runs every Bandcamp player on the page (src/components/BandcampPlayer.astro).
//
// A player's data-state says what shows:
//   loading  a gray outline covers it while Bandcamp draws its player
//   ready    Bandcamp's player
//   error    Bandcamp did not answer in time: a Listen on Bandcamp link
//   gone     Bandcamp has removed the release: a gray "Not available" panel
//
// The component's own small script lifts the outline when Bandcamp says its
// player is drawn. This script adds two backups: the outline also lifts 2
// seconds after the frame has loaded, and after 8 seconds with no player the
// Listen on Bandcamp link takes its place.

const giveUpAfter = 8000;
const backupAfter = 2000;

function isLoading(box: HTMLElement): boolean {
  return box.dataset.state === "loading";
}

function start(box: HTMLElement): void {
  const frame = box.querySelector("iframe");
  if (!frame) return;

  frame.addEventListener("load", () => {
    window.setTimeout(() => {
      if (isLoading(box)) box.dataset.state = "ready";
    }, backupAfter);
  });

  // A lazy player only starts loading near the screen, so its clock starts
  // there too.
  const watch = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      watch.disconnect();
      window.setTimeout(() => {
        if (isLoading(box)) box.dataset.state = "error";
      }, giveUpAfter);
    },
    { rootMargin: "200px" },
  );
  watch.observe(box);
}

for (const box of document.querySelectorAll<HTMLElement>(".player-frame")) {
  start(box);
}
