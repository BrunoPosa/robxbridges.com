# Site content

Edit this file to change the site. One work per bullet, under the heading it belongs to. Keep Aryk first.

A YouTube link can include a start time, written as `t=1744s` in the address. Aryk already has one.

To add a year, a description, or credits, indent the next line by two spaces, like this:

```
- Aryk!: https://www.youtube.com/watch?v=VIDEO
  - year: 2026
  - summary: A few sentences about the piece.
  - credits: Music by Rob Bridges
```

Those indented lines belong to the work bullet directly above them.

A collaboration is a name, an https link, and any of these notes:

```
- Ada Example: https://example.com
  - role: Director
  - project: Aryk
  - year: 2024
  - cover: public/images/collabs/ada-song.jpg
  - player: 1234567890
  - instagram: https://www.instagram.com/ada/
```

`cover` is a square picture, about 800 pixels wide, saved in `public/images/collabs/`. `player` is the Bandcamp track number: on the track's Bandcamp page, press Share / Embed and copy the number after `track=`. With a player, the track plays right on the page.

Put the newest collaboration first.

Write the bio as normal paragraphs under About. A blank line starts a new paragraph. The only bullet there is a photo, and the file has to sit in this project:

```
- Photo: public/images/about.jpg
```

To link a work from the bio, put its exact title in square brackets: `[Aryk!]` links to Aryk! on the Films page. To show different words, add the title in round brackets after them: `[not/local](not/local with Kir)`. Any film, release, track, or collaboration works, and so do `Music`, `Films`, and `Collaborations`. A release name followed by `videos`, such as `[music videos](LUNA EP videos)`, goes straight to that release's video stills. So does a track that has a video. A link to another site is `[Straight8](https://...)`. Link a work once, the first time it comes up. If a name in brackets matches nothing, the tests stop and say which one.

The films page shows the YouTube films in this order, each with a Play button. Nothing plays until the visitor presses Play. Aryk starts at its start time. The year, summary, and credits show under each film. The Chinese Dictionary pieces come after them, as small squares. Under that heading, `Year` and `Summary` lines describe the whole group, and go above the pieces. An `Instagram` line there (the post for Night, the piece in the permanent installation) shows a link under the description. Each piece needs the Instagram post link, an indented `poster` line (a still in `public/films/`), and an indented `video` line (the clip in `public/films/`, made with `scripts/encode-video.sh`, see the README). Pressing a piece plays the clip over the page. The Instagram link shows under it.

The music page plays every release under Music, in the order written here. Each release is its own heading. Under it, give the Bandcamp link, the player number, and the cover file. A single is just those three lines. An album lists its tracks underneath, in order. A track with a video uses a YouTube link, then an indented `player` line with that track’s Bandcamp number. A track without a video is the title alone, then the same `player` line. `Credit` shows above the player on that release. Cover files should be about 800 pixels on the long side.

Icons use the Social list. A blank YouTube or Instagram line hides that icon until you paste a profile link.

## Site

- Name: Rob Bridges
- Role: Composer, Sound Designer, Producer, DJ
- Email: robbridgesmusic@gmail.com

## Social

- YouTube:
- Instagram:
- Bandcamp: https://robbridgesmusic.bandcamp.com/
- Spotify: https://open.spotify.com/artist/2kS1RhFIh7qOvtp0PNv1uh

## Music

- Bandcamp: https://robbridgesmusic.bandcamp.com/
- Spotify: https://open.spotify.com/artist/2kS1RhFIh7qOvtp0PNv1uh

### LUNA EP

- Album: https://robbridgesmusic.bandcamp.com/album/luna-ep
- Player: 283143371
- Cover: public/images/covers/luna-ep.jpg
- I: LUNA (156): https://www.youtube.com/watch?v=o4ZE9Ps4XQY
  - player: 2438719346
- II: SOL: https://www.youtube.com/watch?v=6Vi-Av_RqP8
  - player: 3165008200
- Rude Wun: https://www.youtube.com/watch?v=SoAd-e3edfo
  - player: 493796160
- Mind.Body.Soul
  - player: 1961603828
- The One You Didn't Expect
  - player: 3607538238

### Ma' Shran Di Part II

- Album: https://robbridgesmusic.bandcamp.com/album/ma-shran-di-part-ii
- Player: 3439996449
- Cover: public/images/covers/ma-shran-di-part-ii.jpg
- Overture
  - player: 970178997
- MSG
  - player: 3163553191
- Flood
  - player: 2893713890
- I'll Race You After Sunset
  - player: 3829248916

### Ma' Shran Di Part I

- Album: https://robbridgesmusic.bandcamp.com/album/ma-shran-di-part-i
- Player: 1143402031
- Cover: public/images/covers/ma-shran-di-part-i.jpg
- Intro (And Suddenly The Whole World Welcomed You With Open Arms)
  - player: 3523813909
- Two Birds, One Stone
  - player: 2289112257
- Slow Dance For An Apocalypse
  - player: 174237647

### i believe now

- Album: https://robbridgesmusic.bandcamp.com/track/i-believe-now
- Player: 797509581
- Cover: public/images/covers/i-believe-now.jpg

### Hi feat. jimbojams

- Album: https://robbridgesmusic.bandcamp.com/track/hi-feat-jimbojams
- Player: 3759678051
- Cover: public/images/covers/hi-feat-jimbojams.jpg

### CHANGES feat. Berto

- Album: https://robbridgesmusic.bandcamp.com/track/changes-feat-berto
- Player: 2526680040
- Cover: public/images/covers/changes-feat-berto.jpg

### 200MPH

- Album: https://robbridgesmusic.bandcamp.com/track/200mph
- Player: 2621421910
- Cover: public/images/covers/200mph.jpg

### LISKODISKO

- Album: https://robbridgesmusic.bandcamp.com/album/liskodisko
- Player: 1896683770
- Cover: public/images/covers/liskodisko.jpg
- LISKOINTRO
  - player: 741118438
- LISKODISKO
  - player: 1008677519

### You Take My Breath Away feat. Da We

- Album: https://robbridgesmusic.bandcamp.com/track/you-take-my-breath-away-feat-da-we
- Player: 2737065747
- Cover: public/images/covers/you-take-my-breath-away-feat-da-we.jpg

### 0000-Fuzz

- Album: https://robbridgesmusic.bandcamp.com/track/0000-fuzz
- Player: 1140939453
- Cover: public/images/covers/0000-fuzz.jpg

### 3.14

- Album: https://robbridgesmusic.bandcamp.com/track/314
- Player: 1450975392
- Cover: public/images/covers/314.jpg

### 7.17_2:12

- Album: https://robbridgesmusic.bandcamp.com/track/717-2-12
- Player: 4078851580
- Cover: public/images/covers/717-2-12.jpg

### rX ii-160 9/8_30.6.wav

- Album: https://robbridgesmusic.bandcamp.com/track/rx-ii-160-9-8-306-wav
- Player: 465600959
- Cover: public/images/covers/rx-ii-160-9-8-306-wav.jpg

### XLR8 EP

- Album: https://robbridgesmusic.bandcamp.com/album/xlr8-ep
- Player: 2041602632
- Cover: public/images/covers/xlr8-ep.jpg
- standing in it
  - player: 3056689069
- vis medicatrix naturae
  - player: 475164863
- stone in motion
  - player: 3319120599
- XLR8
  - player: 4096994731

### Y7 EP

- Album: https://robbridgesmusic.bandcamp.com/album/y7-ep
- Player: 782929834
- Cover: public/images/covers/y7-ep.jpg
- Y7
  - player: 1092340764
- A Place Underneath
  - player: 3073266049
- Where Supercomputers Holiday
  - player: 3640106748
- To Yesterday's Ghost
  - player: 3852741867

### Late Drive - Hibition (Rob Bridges Remix)

- Album: https://robbridgesmusic.bandcamp.com/track/late-drive-hibition-rob-bridges-remix
- Player: 120726036
- Cover: public/images/covers/late-drive-hibition-rob-bridges-remix.jpg

### Tangent

- Album: https://robbridgesmusic.bandcamp.com/track/tangent
- Player: 298607248
- Cover: public/images/covers/tangent.jpg

### FORM and VOID EP

- Album: https://robbridgesmusic.bandcamp.com/album/form-and-void-ep
- Player: 390642853
- Cover: public/images/covers/form-and-void-ep.jpg
- i - form and void
  - player: 2898166544
- ii - deus ex machina
  - player: 1230829408

### Forbidden Fruit Radio

- Album: https://robbridgesmusic.bandcamp.com/album/forbidden-fruit-radio
- Player: 759920227
- Cover: public/images/covers/forbidden-fruit-radio.jpg
- Simple, Silly, Crazy
  - player: 2617618890
- Soft Landing, Crystal Blimp
  - player: 3939944508
- Devil's in Paris (Parts 6, 6, & 6)
  - player: 3659300712
- Inner Piece
  - player: 2745966748
- So Lonely
  - player: 3297681544
- Easy
  - player: 3035751674
- David Lynch
  - player: 1792839546
- Toke Notes
  - player: 3624390051
- They Can Kill You, but the Legalities of Eating You Are Quite a Bit Dicier
  - player: 162495585
- Before What's After
  - player: 2850944517

## Films

- Aryk!: https://www.youtube.com/watch?v=N7bynxXfhKI&t=1744s
  - year: 2026
  - summary: Original jazz score for a short film made for Straight8, where it placed in the Top 8 in 2026. The film went on to screen at Cannes (May 16, 2026), at BFI IMAX (May 23, 2026), and Cambridge Film Festival (October 28, 2026). Follows the story of two boys racing bottlecaps through the canals of Almaty.
- Apostate: https://www.youtube.com/watch?v=fluSgAKaUnk
  - year: 2025
  - summary: Score and sound design for the film, which screened at Kino Konepaja in Helsinki on March 20, 2026. Based in the universe of Dune, the movie tells the story of a Bene Gesserit sister, whose faith will be challenged to the greatest length. Apostate is a psychological visual thriller that explores the destructive blind faith, power struggles, and questions of loyalty that come with following a cause greater than oneself.
- Smoke With Me: https://www.youtube.com/watch?v=a1Lpj-E_t5Y
  - year: 2025
  - summary: Composer and producer of the original song. A goth audio-visual short film telling the ghostly tale of two doomed lovers.
- Film Reel: https://www.youtube.com/watch?v=v4UQOVjNgGU

### Chinese Dictionary

- Year: 2022–2025
- Summary: Composer and sound designer for the projects. ‘Night’ is part of a permanent installation in the Kyra lounge at Hong Kong International Airport.
- Instagram: https://www.instagram.com/p/CgjfzfvjmpX/
- Flow: https://www.instagram.com/p/DGVfSDux34g/
  - poster: public/films/flow.jpg
  - video: public/films/flow.mp4
- Night: https://www.instagram.com/p/CgjfzfvjmpX/
  - poster: public/films/night.jpg
  - video: public/films/night.mp4
- Speed: https://www.instagram.com/p/CrYoACvOI96/
  - poster: public/films/speed.jpg
  - video: public/films/speed.mp4
- Tank: https://www.instagram.com/p/Cgea6y6DIAI/
  - poster: public/films/tank.jpg
  - video: public/films/tank.mp4
- Moon: https://www.instagram.com/p/CdDihS3jLqC/
  - poster: public/films/moon.jpg
  - video: public/films/moon.mp4
- Lost: https://www.instagram.com/p/Cb-SmhYjwwt/
  - poster: public/films/lost.jpg
  - video: public/films/lost.mp4

## Collaborations

- DJ WUF: https://djwuf.bandcamp.com/track/2-disrupt
  - project: 2 Disrupt
  - role: Written, produced and mixed together
  - year: 2026
  - cover: public/images/collabs/2-disrupt.jpg
  - player: 2336086847
- not/local with Kir: https://notxlocal.bandcamp.com/track/bigtime
  - project: BIGTIME
  - role: Pop/EDM duo
  - year: 2025
  - cover: public/images/collabs/bigtime.jpg
  - player: 124533583
  - instagram: https://www.instagram.com/notxlocal/

## About

Rob Bridges is a Finnish-American composer, sound designer, producer and DJ based in Helsinki. A classical start on cello gave way to jazz on trumpet and guitar, leading to jazz guitar studies at the University of the Arts in Philadelphia. He has worked as a freelance composer and sound designer, with a body of work that spans film scores, installation audio and club-ready electronic music. Alongside his acoustic roots, he brings a love for modular synthesis and electronic production to everything he makes.

His film work includes the original jazz score for [Aryk!], which placed in the Top 8 at Straight8 2026 and screened at Cannes Film Festival, BFI IMAX and Cambridge Film Festival. He also scored [Apostate], made the audio for a permanent installation at Hong Kong International Airport’s Kyra Lounge ([The Chinese Dictionary](Chinese Dictionary)), and has directed and edited [music videos](LUNA EP videos) for his own projects and other artists.

Beyond composing and commissioned work, he performs as a DJ and as half of the pop/EDM duo [not/local](not/local with Kir).
