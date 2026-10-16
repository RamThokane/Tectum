# Demo accounts + NEET-PG content

Creates 100 demo MBBS accounts (flagged `isDemo`, cannot log in), ~329 hard NEET-PG posts and
cases (every case has a 4-option poll with the answer hidden until a member votes or reveals),
and 5-10 likes per item from other demo accounts.

| Command (run inside `server/`) | What it does |
| --- | --- |
| `npm run seed-demo:check` | Checks the content files (counts, 4 options, privacy check, near-duplicates) and prints the plan. No database. |
| `npm run seed-demo:csv` | Writes `server/demo-review.csv` (all cases + posts with answers) for medical review. No database. |
| `$env:MONGO_URI="memory"; npm run seed-demo` | Creates/updates the demo data in the local test database. Safe to run again: nothing is duplicated. |
| `$env:MONGO_URI="memory"; npm run seed-demo:cleanup` | Deletes every demo account and everything they made, and their likes on other posts. |

The script refuses to touch a non-local database (the live site) unless `--production` is added,
e.g. `node scripts/seed-demo --production`. Only do that after the CSV review.

- All numbers are in `config.js`. Top Contributors' formula, 30-day window and
  `HIDE_DEMO_IN_RANKINGS` are in `src/utils/rankings.js` (the env var `HIDE_DEMO_IN_RANKINGS=true`
  on the server hides demo accounts from Top Contributors and Who to follow).
- Content lives in `content/<ward>.js`, one file per Ward. Edit an item and re-run: the text
  in the database is updated in place (matched by its `key`).
- Wards are read from `src/data/wards.js`; subjects are mapped in `subjects.js`. Forensic
  Medicine has no Ward, so it is reported as missing.
