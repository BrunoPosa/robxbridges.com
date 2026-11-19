#!/usr/bin/env bash
# Turns any video file into a web-ready clip for the films page.
#
#   scripts/encode-video.sh ~/Downloads/flow-original.mov flow
#
# makes public/films/flow.mp4 (and public/films/flow.jpg if there is no still yet).
# Then add the lines to references/links.md, under the piece:
#   - poster: public/films/flow.jpg
#   - video: public/films/flow.mp4
#
# Needs ffmpeg (Ubuntu: sudo apt install ffmpeg, Mac: brew install ffmpeg).
#
# What it does, and why:
#   - H.264 video + AAC sound in MP4: plays in every browser.
#   - At most 720 pixels on the short side: sharp for these clip sizes, about
#     half the file size of 1080p. Smaller sources are never enlarged.
#   - CRF 23, capped at 2 Mbps: good quality, and busy, grainy clips cannot
#     balloon. Lower CRF = bigger and sharper.
#   - A source that is already web-ready (H.264, 720p or less, 2.5 Mbps or
#     less, e.g. a download from Instagram) is copied as is, not re-encoded:
#     re-encoding would only make it bigger and softer.
#   - +faststart: the index goes at the front, so playback starts at once.
#   - map_metadata -1: drops camera/phone details such as location.
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: scripts/encode-video.sh <source video> <short-name, e.g. flow>" >&2
  exit 1
fi

source_file="$1"
name="$2"

if ! [[ "$name" =~ ^[a-z0-9-]+$ ]]; then
  echo "The short name may use only a-z, 0-9 and dashes (e.g. flow, night-2)." >&2
  exit 1
fi
if ! command -v ffmpeg >/dev/null; then
  echo "ffmpeg is not installed. See the top of this script." >&2
  exit 1
fi

cd "$(dirname "$0")/.."
video="public/films/$name.mp4"
poster="public/films/$name.jpg"

# Read the source's codec, size and video bitrate (falls back to the file's).
probe() { ffprobe -v error -select_streams v:0 -show_entries "$1" -of csv=p=0 "$source_file"; }
IFS=, read -r codec width height bitrate <<<"$(probe stream=codec_name,width,height,bit_rate)"
[[ "$bitrate" =~ ^[0-9]+$ ]] || bitrate="$(probe format=bit_rate)"
short_side=$((width < height ? width : height))

if [ "$codec" = "h264" ] && [ "$short_side" -le 720 ] && [ "${bitrate:-99999999}" -le 2500000 ]; then
  echo "Already web-ready: copying without re-encoding."
  video_options=(-c:v copy)
else
  video_options=(
    -vf "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'"
    -c:v libx264 -preset slow -crf 23 -maxrate 2M -bufsize 4M
    -profile:v high -pix_fmt yuv420p
  )
fi

ffmpeg -hide_banner -loglevel error -y -i "$source_file" \
  -map 0:v:0 -map 0:a:0? -map_metadata -1 -map_chapters -1 \
  "${video_options[@]}" \
  -c:a aac -b:a 128k -ac 2 \
  -movflags +faststart \
  "$video"

if [ ! -f "$poster" ]; then
  # A still from one second in. Swap it for a nicer frame any time.
  ffmpeg -hide_banner -loglevel error -y -ss 1 -i "$video" -frames:v 1 -q:v 3 "$poster"
  echo "Made $poster"
fi

echo "Made $video ($(du -h "$video" | cut -f1))"
