#!/bin/sh
set -eu

career="${JOB_CAREER_DIR:-$HOME/data/job}"
case $career in "~") career=$HOME ;; "~/"*) career=$HOME/${career#"~/"} ;; esac

snapshot=$(cat)

window() {
  printf '%s' "$snapshot" | sed -n "s/.*\"$1\":{[^}]*\"used_percentage\":\([0-9][0-9.]*\).*/\1/p" | head -1
}

five=$(window five_hour)
week=$(window seven_day)

if [ -n "$five" ]; then
  mkdir -p "$career"
  printf '%s' "$snapshot" > "$career/usage.json.part" && mv "$career/usage.json.part" "$career/usage.json"
fi

[ -n "$five" ] && printf '5h %.0f%%' "$five"
[ -n "$five" ] && [ -n "$week" ] && printf '  ·  '
[ -n "$week" ] && printf 'wk %.0f%%' "$week"
exit 0
