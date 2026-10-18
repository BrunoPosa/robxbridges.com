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

`npm test` fails when a line in `references/links.md` is incomplete or points at the wrong kind of page. A film must be a YouTube link. A Chinese Dictionary piece must be an Instagram post. Aryk stays first and keeps a start time.

## Home picture

`public/images/hero-plate.jpg` and `public/images/hero-foreground.png` are a placeholder still, not a photograph of Rob. The home page draws the name between them, so the letters pass behind the foreground shape.

To use another picture, replace both files. Keep the same names and the same pixel size. The PNG is only the shape that should cover the name. The rest of that file is transparent.

## Music

The music page plays every release under Music in `references/links.md`, in that order. Each release is a heading, then the Bandcamp link, the player number, and the cover file in `public/images/covers/`. A single is just those three lines. An album lists its tracks under them. A track with a video uses a YouTube link and an indented `player` line. A track without a video is the title, then that `player` line. `Credit` replaces the name on that card.

The large cover is the release that is playing. Choosing Play, or a track, switches it.

## Films

The films page plays every YouTube film under Films in `references/links.md`, in that order. Each film fills the screen. The next one comes in on scroll. Aryk stays first and starts at the `t=` time in its link. The bar under the picture shows the title, and a summary when that indented line is there. Sound starts off. One film plays at a time. Marks on the left show which piece is on screen. Hovering them shows the titles, and choosing one moves to that piece. Top, under the header, returns to the first film from anywhere on the page.

A `credits` line stays hidden until the visitor presses Credits. That opens the words on a dim layer over the picture. Pieces without a credits line have no Credits button.

Chinese Dictionary pieces follow the films. A piece needs an Instagram post link and a `poster` line, such as `public/films/flow.jpg`. The page shows that still in a square. The Instagram embed loads in the square only while that piece is on screen, and the video stays on Instagram. Instagram also stays as a link in the bar.

## Collaborations and about

Collaborations are the bullets under Collaborations in `references/links.md`. Each one is a name and an https link. `role`, `project`, and `year` are optional indented lines. They show under the name. An empty section leaves one line on the page: selected work with others will be listed here.

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

## Moving the site to Rob later

In Vercel, transfer the project to Rob's account. Or have Rob create a project and replace the three GitHub secrets with his. The GitHub repo can move to his account the same way.
