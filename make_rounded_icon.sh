#!/bin/bash
set -euo pipefail

SOURCE=${1:-}
OUTPUT=${2:-AppIcon.icns}

if [[ -z "$SOURCE" || ! -f "$SOURCE" ]]; then
  echo "Usage: $0 source.png [output.icns]" >&2
  exit 1
fi

node scripts/make-rounded-icon.js "$SOURCE" "$OUTPUT"
