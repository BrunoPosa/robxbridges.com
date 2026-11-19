// Makes small copies of the album covers for the row of covers on the music
// page. It runs by itself before `npm run dev` and `npm run build`.
// Rob never runs it by hand. The copies are not saved in git.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const covers = "public/images/covers";
const thumbs = path.join(covers, "thumbs");
fs.mkdirSync(thumbs, { recursive: true });

for (const name of fs.readdirSync(covers)) {
  if (!/\.jpe?g$/i.test(name)) continue;
  const source = path.join(covers, name);
  const target = path.join(thumbs, name);
  // Skip covers that already have an up-to-date copy.
  if (
    fs.existsSync(target) &&
    fs.statSync(target).mtimeMs >= fs.statSync(source).mtimeMs
  ) {
    continue;
  }
  await sharp(source)
    .resize(160, 160, { fit: "cover" })
    .jpeg({ quality: 72 })
    .toFile(target);
}
