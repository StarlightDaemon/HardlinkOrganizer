# Prompt 84 — Add Missing DB Indexes

**Target model:** Gemini 3 Flash (or Claude Haiku 4.5)
**Effort:** Minimal — two lines added to an existing string constant
**Run order:** Can run in parallel with Prompt 83. Run before Prompt 85.

---

## Context

HardlinkOrganizer persists state in a SQLite database managed by
`engine/db.py`. The schema is defined in the module-level `_SCHEMA` string
constant (lines 22–112). Two query methods in `Database` filter on columns
that have no index, causing full table scans as the inventory grows.

---

## The gap

`get_inode_peers` (db.py:367) executes:

```sql
WHERE i.inode = ? AND i.device_id = ?
```

There is no index on `inventory(inode, device_id)` — full scan every call.

`get_link_status` (db.py:339) and `get_history_for_path` (db.py:327) execute:

```sql
WHERE full_path IN (...)
WHERE full_path = ?
```

There is no index on `link_history(full_path)` — full scan on every batch
check and every per-path history lookup.

---

## Change required

In `engine/db.py`, at the end of the `_SCHEMA` string constant (just before
the closing `"""`), append two `CREATE INDEX IF NOT EXISTS` statements:

```sql
CREATE INDEX IF NOT EXISTS idx_inventory_inode
    ON inventory (inode, device_id);

CREATE INDEX IF NOT EXISTS idx_link_history_full_path
    ON link_history (full_path);
```

`CREATE INDEX IF NOT EXISTS` is idempotent in SQLite. The existing schema
runs via `executescript(_SCHEMA)` on every startup, so these indexes will be
created on first startup against an existing DB and be a no-op thereafter.
**No migration guard (ALTER TABLE / try-except) is needed.**

---

## Verification

```bash
cd /Users/dante/Citadel/HardlinkOrganizer && python -m unittest discover -s ./tests -v 2>&1 | tail -10
```

All existing tests must pass. Also confirm that the two index names appear in
the schema by running:

```bash
cd /Users/dante/Citadel/HardlinkOrganizer && python -c "
import tempfile, os
from engine.db import Database
with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
    db_path = f.name
db = Database(db_path)
conn = db._connection
rows = conn.execute(\"SELECT name FROM sqlite_master WHERE type='index'\").fetchall()
for r in rows: print(r[0])
db.close()
os.unlink(db_path)
"
```

The output must include `idx_inventory_inode` and `idx_link_history_full_path`.

---

## Constraints

- Change only `engine/db.py`. No other files.
- Do not add migration guards — `IF NOT EXISTS` is sufficient.
- Do not reorder or reformat any other part of `_SCHEMA`.
- Do not change any method implementations.
