import { defineConfig } from "astro/config";

// Static HTML. The host only has to serve files, which keeps the site easy to move later.
// The content policy is in vercel.json. script-src allows inline scripts because
// Astro writes the page scripts into the HTML, including the contact form.
export default defineConfig({
  site: "https://robxbridges.com",
  output: "static",
});
