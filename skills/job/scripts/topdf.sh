#!/bin/bash
set -euo pipefail

IN="$1"
OUT="${2:-${IN%.docx}.pdf}"
IN_ABS="$(cd "$(dirname "$IN")" && pwd)/$(basename "$IN")"
OUT_DIR="$(cd "$(dirname "$OUT")" && pwd)"
OUT_ABS="$OUT_DIR/$(basename "$OUT")"

SOFFICE="$(command -v soffice || true)"
[ -n "$SOFFICE" ] || SOFFICE="/Applications/LibreOffice.app/Contents/MacOS/soffice"

if [ ! -x "$SOFFICE" ]; then
  echo "no converter found: brew install --cask libreoffice" >&2
  exit 1
fi

"$SOFFICE" --headless --convert-to pdf --outdir "$OUT_DIR" "$IN_ABS" >/dev/null
RENDERED="$OUT_DIR/$(basename "${IN_ABS%.docx}").pdf"
[ "$RENDERED" = "$OUT_ABS" ] || mv "$RENDERED" "$OUT_ABS"

echo "wrote $OUT_ABS"
