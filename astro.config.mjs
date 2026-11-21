import { defineConfig } from "astro/config";

// Static HTML. The host only has to serve files, which keeps the site easy to move later.
// The content policy is in vercel.json. script-src allows inline scripts because
// Astro writes the page scripts into the HTML, including the contact form.
export default defineConfig({
  site: "https://robxbridges.com",
  output: "static",
  build: {
    // The content policy (style-src 'self') blocks <style> tags in the page,
    // so every stylesheet must ship as its own file. Left on "auto", Astro
    // pastes small stylesheets into the page and they silently stop working
    // on the live site. scripts/check-build.ts guards this.
    inlineStylesheets: "never",
  },
});
