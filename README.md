# robxbridges.com

Portfolio site for Rob Bridges. The pages are a static Astro site. The works themselves live in one file: `references/links.md`.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:4321

## Change the works

Edit `references/links.md`. The notes at the top of that file explain how to add a track, a film, a credit, or a social link.

Then check the file before you publish:

```bash
npm test
npm run build
```

`npm test` fails when a line in `references/links.md` is incomplete or points at the wrong kind of page. A film must be a YouTube link. A Chinese Dictionary piece must be an Instagram post with a still and a clip. Aryk stays first and keeps a start time.

## Fonts

Two lines at the top of `src/styles/global.css` choose the fonts: `--font-display` for headings and `--font-ui` for everything else. Both are Outfit for now. The big name on the home page is Inter. To try another font, install it from Fontsource (for example `npm install @fontsource/manrope`), import its weights in `src/layouts/Base.astro`, and change those lines.

## Home picture

`public/images/hero-plate.jpg` and `public/images/hero-foreground.png` are a placeholder still, not a photograph of Rob. The home page draws the name between them, so the letters pass behind the foreground shape.

To use another picture, replace both files. Keep the same names and the same pixel size. The PNG is only the shape that should cover the name. The rest of that file is transparent.

## Music

The music page plays every release under Music in `references/links.md`, in that order. Each release is a heading, then the Bandcamp link, the player number, and the cover file in `public/images/covers/`. A single is just those three lines. An album lists its tracks under them. A track with a video uses a YouTube link and an indented `player` line. A track without a video is the title, then that `player` line. `Credit` shows above the player on that release. A cover should be about 800 pixels on the long side. A much larger file fails `npm test`.

The large cover is the release in view, with its name above it. Bandcamp’s player sits on the right, joined to the cover by a small gap at any window size, and on a phone it sits under the cover. The play button on that player starts the music, and the timeline and track times stay in the player. The release name inside the player links to its Bandcamp page. Under the cover, Previous, the counter (such as 01 / 20), and Next sit over a row of small covers for every release. The lit one is in view and slides to the middle of the row. Each end of the row fades to dark while there are more covers that way. Choosing a small cover moves to that release. While Bandcamp’s player loads, a dark outline of its track list holds that space, so the list never flashes white. On the page’s first load the outline covers the top of the player too. It lifts on its own after 8 seconds at most. If it has not loaded after 15 seconds, a Listen on Bandcamp link takes its place. With a mouse or trackpad, scrolling over the large cover moves one release at a time. Anywhere else, the page scrolls as usual. Previous, Next, and the left and right arrow keys also move one release. On a phone, a sideways swipe on the cover moves one release. A track with a video shows its still under the player. Pressing it opens the video over the page.

The small covers are made from the large ones by `scripts/make-thumbs.ts`. It runs by itself before `npm run dev` and `npm run build`, so there is nothing extra to do when you add a cover.

## Films

The films page shows every YouTube film under Films in `references/links.md`, in that order. Each film is a still with a Play button, and nothing plays until the visitor presses it. Starting a second film pauses the first. Aryk stays first and starts at the `t=` time in its link. Under each film are its title, then the indented `year`, `summary`, and `credits` lines when they are there, and a YouTube link.

Chinese Dictionary pieces follow the films as small squares, three across (two on a phone). The `Year` and `Summary` lines under the Chinese Dictionary heading describe the whole group. A piece needs an Instagram post link, a `poster` line such as `public/films/flow.jpg`, and a `video` line such as `public/films/flow.mp4`. Pressing a square plays the clip over the page at once, with an Instagram link under it. Close, Escape, or a click outside it closes it.

The clips live on this site, so nothing waits on Instagram. A clip downloads only when someone presses its square.

### Add or replace a clip

1. Install ffmpeg once (Mac: `brew install ffmpeg`, Ubuntu: `sudo apt install ffmpeg`).
2. Run `scripts/encode-video.sh path/to/original.mov flow` (any video file works; `flow` is the short name).
3. That makes `public/films/flow.mp4`, about 2–6 MB, and a still `public/films/flow.jpg` if there isn't one yet. Swap in a nicer still any time, but keep it the same shape as the clip.
4. Add the piece to `references/links.md`:

   ```
   - Flow: https://www.instagram.com/p/DGVfSDux34g/
     - poster: public/films/flow.jpg
     - video: public/films/flow.mp4
   ```

`npm test` fails if a clip is missing, too heavy to stream smoothly (over 2.6 Mbps or 25 MB), or not made with the script.

## Collaborations and about

Collaborations are the bullets under Collaborations in `references/links.md`, newest first. Each one is a name and an https link. `project`, `role`, and `year` are optional indented lines. They show under the name. An indented `cover` line (a square picture about 800 pixels wide, saved in `public/images/collabs/`) shows the record beside the words. An indented `player` line, the Bandcamp track number (Share / Embed on the track's Bandcamp page, the number after `track=`), puts a player in that row. An indented `instagram` line adds an Instagram link under it. An empty section leaves one line on the page: selected work with others will be listed here.

The bio is the paragraphs under About. A blank line starts a new paragraph. Those words, and the contact form, sit at the bottom of every page. A photo is one bullet, `Photo: public/images/about.jpg`, and that file has to exist. Until the paragraphs are written, the About heading is there on its own.

## Publish

Edit `references/links.md`. Commit, then push `main`.

GitHub runs the checks. The live site changes only when they pass.

A red check means a line in the catalog is incomplete, or the build failed. On your machine, run `npm test` and `npm run build`, fix the file, and push again.

The contact form does not send email. Submit stays on the page while the site is being built.

## First-time host setup

Do this once. The publisher is GitHub Actions, on a Vercel Hobby project.

1. From this folder, run `npx vercel@64.5.0 link`. Sign in, pick your account, and create a project. Leave Git unconnected. If Vercel later shows a repository under Project, Settings, Git, disconnect it.
2. Open `.vercel/project.json`. It has `orgId` and `projectId`. That folder stays off git.
3. In Vercel, open Account Settings, Tokens, and create a token. Copy it once.
4. On GitHub, open BrunoPosa/robxbridges.com, then Settings, Secrets and variables, Actions. Add three repository secrets:
   - `VERCEL_TOKEN` is the token.
   - `VERCEL_ORG_ID` is `orgId`.
   - `VERCEL_PROJECT_ID` is `projectId`.

The next push to `main` publishes the site. Until those three secrets exist, the checks still run and the publish step skips.

## Domain

Register `robxbridges.com`. In the Vercel project, open Domains and add that name. At the registrar, add the DNS records Vercel shows.

Until that domain is attached, the pages ask search engines not to index the site. After it is, delete the robots meta tag in `src/layouts/Base.astro` and change `public/robots.txt` back to `Allow: /`.

## Moving the site to Rob later

In Vercel, transfer the project to Rob's account. Or have Rob create a project and replace the three GitHub secrets with his. The GitHub repo can move to his account the same way.
