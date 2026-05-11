#!/usr/bin/env bash
#
# Generate a JSON index of the local music library for dev-mode browsing.
# Run from the project root: ./scripts/index-music.sh
#

MUSIC_DIR="music"
OUTPUT="static/music-index.json"

if [ ! -d "$MUSIC_DIR" ]; then
  echo "No music/ directory found. Skipping index generation."
  exit 0
fi

mkdir -p static

# Collect all audio files
mapfile -t files < <(find -L "$MUSIC_DIR" -type f \( -name "*.mp3" -o -name "*.flac" -o -name "*.ogg" -o -name "*.wav" -o -name "*.m4a" \) | sort)

echo "[" > "$OUTPUT"

for i in "${!files[@]}"; do
  filepath="${files[$i]}"
  relpath="${filepath#music/}"

  # Extract artist/album from path
  artist=$(echo "$relpath" | cut -d'/' -f1 | tr '_' ' ')
  album=$(echo "$relpath" | cut -d'/' -f2 | tr '_' ' ')
  filename=$(basename "$filepath")
  # Clean up track name: remove "Artist - " prefix, track numbers, extension
  title=$(echo "$filename" | sed -E 's/^[^-]*- //; s/^[0-9]+\. //; s/\.[^.]+$//')

  # JSON-escape
  artist_esc=$(echo "$artist" | sed 's/\\/\\\\/g; s/"/\\"/g')
  album_esc=$(echo "$album" | sed 's/\\/\\\\/g; s/"/\\"/g')
  title_esc=$(echo "$title" | sed 's/\\/\\\\/g; s/"/\\"/g')
  path_esc=$(echo "$filepath" | sed 's/\\/\\\\/g; s/"/\\"/g')

  if [ "$i" -gt 0 ]; then
    printf ',\n' >> "$OUTPUT"
  fi

  printf '  {"artist":"%s","album":"%s","title":"%s","path":"%s"}' \
    "$artist_esc" "$album_esc" "$title_esc" "$path_esc" >> "$OUTPUT"
done

echo "" >> "$OUTPUT"
echo "]" >> "$OUTPUT"

echo "Indexed ${#files[@]} tracks → $OUTPUT"
