#!/usr/bin/env bash
# Builds timezone-switcher.zip for Chrome Web Store upload. Bump "version" in manifest.json first.
set -euo pipefail
cd "$(dirname "$0")"

rm -f timezone-switcher.zip
zip -qr timezone-switcher.zip manifest.json background.js tz-shim.js tz-boot.js popup.html popup.js popup.css data icons -x "*.DS_Store"

version=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
echo "built timezone-switcher.zip (v$version)"
