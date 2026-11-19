// Makes small image copies the site serves instead of the large originals:
//   - album covers for the row of covers on the music page
//   - WebP stills for the Chinese Dictionary squares on the films page
// It runs by itself before `npm run dev` and `npm run build`.
// Rob never runs it by hand. The copies are not saved in git.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// True when the copy exists and is newer than its source.
function upToDate(source: string, target: string): boolean {
  return (
    fs.existsSync(target) && fs.statSync(target).mtimeMs >= fs.statSync(source).mtimeMs
  );
}

const covers = "public/images/covers";
const coverThumbs = path.join(covers, "thumbs");
fs.mkdirSync(coverThumbs, { recursive: true });

for (const name of fs.readdirSync(covers)) {
  if (!/\.jpe?g$/i.test(name)) continue;
  const source = path.join(covers, name);
  const target = path.join(coverThumbs, name);
  if (upToDate(source, target)) continue;
  await sharp(source)
    .resize(160, 160, { fit: "cover" })
    .jpeg({ quality: 72 })
    .toFile(target);
}

// Two widths per still: phones and small squares use 320, sharp screens 640.
// The films page names these in its srcset, so keep the widths in step.
const films = "public/films";
const filmPosters = path.join(films, "posters");
fs.mkdirSync(filmPosters, { recursive: true });

for (const name of fs.readdirSync(films)) {
  if (!/\.jpe?g$/i.test(name)) continue;
  const source = path.join(films, name);
  const base = name.replace(/\.jpe?g$/i, "");
  for (const width of [320, 640]) {
    const target = path.join(filmPosters, `${base}-${width}.webp`);
    if (upToDate(source, target)) continue;
    await sharp(source)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 74 })
      .toFile(target);
  }
}
