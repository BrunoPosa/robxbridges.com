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

The album layout, the film player, and the publish pipeline are still to come.

The contact form does not send email. Submit stays on the page while the site is being built.
