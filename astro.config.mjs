import { defineConfig } from "astro/config";

// Static HTML. The host only has to serve files, which keeps the site easy to move later.
export default defineConfig({
  site: "https://robxbridges.com",
  output: "static",
});
