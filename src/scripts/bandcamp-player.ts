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
//
// A page that changes release in place (the music page) calls
// findPlayer(box)?.show(view) with a PlayerView from src/data/bandcamp.ts.
import type { PlayerView } from "../data/bandcamp";

const giveUpAfter = 8000;
const backupAfter = 2000;

export type PlayerControl = { show(view: PlayerView): void };

const controls = new WeakMap<Element, PlayerControl>();

export function findPlayer(box: Element | null): PlayerControl | undefined {
  return box ? controls.get(box) : undefined;
}

function start(box: HTMLElement): void {
  const frame = box.querySelector("iframe");
  if (!frame) return;
  const skeletonRows = box.querySelector(".skeleton-rows");
  const errorLink = box.querySelector<HTMLAnchorElement>(".player-error a");
  // Counts the releases shown here, so a timer left from an earlier one
  // does nothing.
  let turn = 0;
  let clock = 0;

  const isLoading = () => box.dataset.state === "loading";

  function startClock(): void {
    const mine = turn;
    window.clearTimeout(clock);
    clock = window.setTimeout(() => {
      if (mine === turn && isLoading()) box.dataset.state = "error";
    }, giveUpAfter);
  }

  frame.addEventListener("load", () => {
    const mine = turn;
    window.setTimeout(() => {
      if (mine === turn && isLoading()) box.dataset.state = "ready";
    }, backupAfter);
  });

  // A lazy player only starts loading near the screen, so its clock starts
  // there too.
  const watch = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      watch.disconnect();
      startClock();
    },
    { rootMargin: "200px" },
  );
  watch.observe(box);

  controls.set(box, {
    show(view) {
      // A removed release loads an empty frame, which also stops the music.
      const src = view.gone ? "about:blank" : view.src;
      if (frame.src === src) return;
      turn += 1;
      window.clearTimeout(clock);
      // From here on the player's top part keeps showing, so the outline
      // only covers the track list.
      delete box.dataset.first;
      frame.src = src;
      frame.title = `${view.title} on Bandcamp`;
      if (view.gone) {
        box.dataset.state = "gone";
        return;
      }
      box.dataset.state = "loading";
      box.dataset.rows = String(view.rows);
      skeletonRows?.replaceChildren(
        ...Array.from({ length: view.rows }, () => {
          const row = document.createElement("span");
          row.className = "skeleton-row";
          return row;
        }),
      );
      if (errorLink) errorLink.href = view.url;
      frame.style.height = `${view.height}px`;
      frame.height = String(view.height);
      startClock();
    },
  });
}

for (const box of document.querySelectorAll<HTMLElement>(".player-frame")) {
  start(box);
}
