#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob
parts=(samana-source.tar.gz.part-*)
if ((${#parts[@]})); then
  archive="$(mktemp)"
  trap 'rm -f "$archive"' EXIT
  cat "${parts[@]}" > "$archive"
  tar -tzf "$archive" >/dev/null
  tar -xzf "$archive" -C .
fi

pnpm install --frozen-lockfile
