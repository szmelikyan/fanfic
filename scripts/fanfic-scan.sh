#!/bin/zsh
# The full fanfic scan in parts, most wanted first: the wanted pairings (and Author.Today), then gen, then followed authors.
# AO3 is tried by the script first; if it does not let the script in, through the reader's browser (an AO3 tab running
# `node fanfic.mjs browser-snippet`). Each part is saved as soon as it is done: <reader dir>/scans/<date>-<part>.json.
# Usage: scripts/fanfic-scan.sh [--reader <name>]   (for cron: NODE=/full/path/to/node)
cd "$(dirname "$0")/.." || exit 1
# Keep the Mac awake for the whole scan (idle and system sleep; on battery only idle sleep can be held).
if [[ -z $FANFIC_AWAKE ]] && command -v caffeinate >/dev/null; then FANFIC_AWAKE=1 exec caffeinate -i -s "$0" "$@"; fi
NODE=${NODE:-node}
day=$(date +%F)
out=$($NODE --input-type=module -e 'import { takeReader } from "./lib/paths.mjs"; console.log(takeReader(process.argv.slice(1)).dir)' -- "$@")/scans
mkdir -p $out
for part in pairings gen authors; do
  echo "$(date '+%F %T') $part"
  $NODE fanfic.mjs scan --part $part --browser "$@" > $out/$day-$part.json 2> $out/$day-$part.log
  echo "$(date '+%F %T') $part done, exit $?"
  # One line per part: when it ran and how often AO3 failed — to pick the best hour for the schedule.
  $NODE -e 'try { const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).run; const a = r.http["archiveofourown.org"] ?? { requests: 0, failed: 0 }; console.log([r.started, r.finished, process.argv[2], r.via, a.requests, a.failed].join("\t")); } catch {}' $out/$day-$part.json $part >> $out/ao3-hours.tsv
done
