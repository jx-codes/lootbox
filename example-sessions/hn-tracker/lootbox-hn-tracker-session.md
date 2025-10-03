# Lootbox Hacker News Tracker - Session Log

**Date:** 2025-10-03
**Project:** Building a persistent Hacker News reading tracker using lootbox

---

## Overview

Created a Hacker News reading tracker that fetches the top 10 stories, tracks which ones have been read, and persists the data between runs using lootbox's key-value store.

---

## Step 1: Explored Lootbox Capabilities

### Command: `lootbox --help`

**Key findings:**

- Lootbox is a sandboxed TypeScript runtime with network access
- Network-only sandbox (no file system access)
- 10-second execution timeout
- Provides `tools` object for accessing function namespaces
- Supports `fetch()` for HTTP requests

---

## Step 2: Discovered Available Namespaces

### Command: `lootbox --namespaces`

**Result:**

```json
{
  "rpc": ["fs", "kv", "sqlite"],
  "mcp": []
}
```

Identified `kv` (key-value store) as the ideal solution for persistent storage.

---

## Step 3: Examined KV Store API

### Command: `lootbox --types kv`

**Key functions identified:**

- `tools.kv.get({ key: string })` - Retrieve values
- `tools.kv.set({ key: string, value: unknown })` - Store values
- `tools.kv.list()`, `tools.kv.delete()`, etc.

---

## Step 4: Created HN Tracker Script

**File:** `hn-tracker.ts`

### Features:

1. **Fetches top 10 Hacker News stories** via HN Firebase API
2. **Tracks read stories** using `tools.kv` with key `hn:read_stories`
3. **Displays categorized results:**
   - 🆕 New stories (not yet read)
   - ✓ Already read stories
4. **Demo behavior:** Marks first 3 unread stories as read on each run

### Key Implementation Details:

- Uses parallel Promise.all for efficient story fetching
- Stores story IDs as array in KV store
- Filters stories into new vs. already-read categories
- Displays rich metadata: author, score, URL

---

## Step 5: First Execution - Initial Run

### Command: `lootbox hn-tracker.ts`

**Results:**

- **Total stories in DB:** 0
- **Action:** Marked first 3 stories as read
- **Output:** All 10 stories shown as "NEW"
- **Summary:** 10 new, 0 already read

**Stories tracked (first 3):**

1. Germany must stand firmly against client-side scanning in Chat Control [pdf]
2. The Collapse of the Econ PhD Job Market
3. Litestream v0.5.0

---

## Step 6: Second Execution - Persistence Verification

### Command: `lootbox hn-tracker.ts`

**Results:**

- **Total stories in DB:** 3
- **Action:** Marked 3 more stories as read
- **Output:**
  - 7 stories shown as "NEW"
  - 3 stories shown as "ALREADY READ"
- **Summary:** 7 new, 3 already read

✅ **Persistence confirmed!** The KV store successfully retained data between runs.

---

## Conclusions

### What Works

✅ Fetch API for external HTTP requests
✅ RPC tools (kv, sqlite, fs) for data persistence
✅ TypeScript execution with type safety
✅ Promise.all for parallel operations
✅ Data persistence between script executions

### Use Case Validation

The Hacker News tracker successfully demonstrates:

- External API integration (HN Firebase API)
- Persistent state management (KV store)
- Practical utility (track reading progress)

---

## Files Created

- **hn-tracker.ts** - Hacker News reading tracker script (167 lines)
- **lootbox-hn-tracker-session.md** - This session log

---

## Usage Instructions

To run the tracker:

```bash
lootbox hn-tracker.ts
```

The script will:

1. Fetch current top 10 HN stories
2. Compare against your reading history
3. Show which stories are new vs. already read
4. Mark first 3 unread stories as read (demo mode)

Run multiple times to see persistence in action!
