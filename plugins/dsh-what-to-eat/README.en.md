# Today's Menu · dsh-what-to-eat

Draws one home-cooked dish from a **local** library at the times you configure, using weighted random selection. A persistent side panel and an in-conversation card share the same data and the same draw.

- No network access, no platform scraping, no model calls, no extra sessions.
- 214 built-in dishes (family / takeout / light / treat / quick scenes; one dish can carry several scenes), each with meal, tags and a short method text; the library is fully editable.
- Everything stays on this machine.

## After install

1. A **Today's Menu** tab appears in the right sidebar (use the card's **Panel** button to open it; reopen it later from the sidebar `+` menu).
2. Three default slots: breakfast 07:30, lunch 11:40, dinner 17:40, every day.
3. When a slot fires, a card appears above the composer: dish name + tags, method expandable; in mode ② it also shows an **Open guide** button.

## Modes

| Mode | Card content |
|---|---|
| ① Name only | Name + tags; method expandable when present |
| ② Name + guide | Adds an **Open guide** button |

Mode is a global default with a per-slot override. Guide link resolution: the entry's own `guide.url` → a generated **search result page** from the configured template (xiachufang by default) → an override URL set in the panel. It never links to a specific post and never fetches platform content.

## Draw rules

1. **Avoided tags exclude an entry from the pool entirely.**
2. **Liked tags multiply weight** (default ×2.2); everything else keeps its base weight.
3. Recently drawn entries are skipped for N days (default 7).
4. The same meal never repeats the same entry on the same day.
5. When the pool runs dry the window relaxes stepwise (`N → ⌈N/2⌉ → 0`) and recently eaten dishes are down-weighted (×0.2–0.7) rather than banned; the card says **Relaxed dedupe**.
6. One dish per draw by default, configurable to 3 candidates (global default, overridable per slot).

## Timing and catch-up

- Slots are data: weekday / time / meal / mode / enabled, editable in the panel.
- Local timezone. A slot fires at most once per day, and that state is persisted, so a restart never re-pushes.
- Missed by up to 30 minutes → still pushed, marked **Catch-up**. Later than that → recorded as missed and shown only in panel history.
- **Quiet hours**: a slot that comes due during quiet hours is deferred to the end of the window and marked catch-up, without the 30-minute limit. The panel warns when a slot time falls inside quiet hours.
- **Across midnight**: a 23:59 slot that only wakes at 00:00 is still pushed for the previous day (it is booked to yesterday's history and dedupe), instead of being swallowed because "today's 23:59 has not arrived yet".
- **No active session**: nothing is created and nothing pops; only the panel updates. The next time a conversation is open, today's latest result appears as a card marked **Catch-up** — one card, not a burst.

## Panel

Today (current result, another draw, history, pool warnings) · Library (search, add/edit/delete, per-entry disable) · Schedule (slot CRUD) · Settings (mode, candidates, window, catch-up, quiet hours, liked/avoided tags, search template, import/export, clear history, reset to factory state).

**Import** accepts JSON, CSV (`name,meal,tags,recipe,url,weight,disabled`) or one dish name per line, always previews first (new / duplicate / conflicting counts plus format errors), writes only after confirmation, and keeps a snapshot for **Undo**. **Export** writes JSON or CSV that can be re-imported.

## Data and privacy

`$DSH_HOME/what-to-eat/state.json` (on Windows: `C:\Users\<you>\.dsh\what-to-eat\state.json`). Nothing is uploaded. DSH does not delete plugin data for you on uninstall: use **Reset to factory state** in the panel (214 built-ins, default slots, no history), then remove the `what-to-eat` folder.

## If the panel does not appear

Open `http://<your DSH host>/dsh-what-to-eat/api/state` in a browser and read `diag`:

```json
"diag": { "clientVersion": "0.1.1", "slots": { "card": true, "tabType": true, "panel": true } }
```

- no `diag` field → the client module was never delivered (restart/refresh, or the plugin is disabled)
- `slots.tabType=false` → the sidebar page type failed to register
- `slots.panel=false` → the panel body failed to register (the sidebar has not declared that keyed slot yet)
- `slots.card=false` → the conversation card failed to register

That endpoint needs no login.

## Compatibility

| Item | Value |
|---|---|
| DSH | verified on `0.2.1-rc.2`; declared range `>=0.2.0-rc.1 <0.3.0-0` |
| Node.js | `>=22.12.0` |
| Platforms | Windows / macOS / Linux (only Windows 11 was actually run; no platform-specific code) |
| Profile | a Profile with the Web client (desktop / web); requires the host `webServer` service |

Depends only on the host `webServer` service and the client `slots` / `sidebarRightTabs` / `sidebarRight` registries.

## Permissions and external dependencies

| Item | Status |
|---|---|
| Network | **no outbound requests**; registers a `/dsh-what-to-eat/api` prefix route on the local DSH webserver for its own front end only |
| Files | reads/writes `$DSH_HOME/what-to-eat/state.json` and nothing else |
| Commands | runs no subprocess or shell command |
| Credentials | reads and stores none |
| Lifecycle scripts | no `preinstall` / `install` / `postinstall` / `prepare` |
| Runtime dependencies | none (Node built-ins only; `react` comes from the host module table) |
| Model calls | none |

## Known boundaries

- The conversation card renders in the composer dock and **writes nothing to the session log**. DSH forbids plugins from appending custom session event types (an unknown type makes the session unopenable, and `appendPluginRecord` is reserved for DSH's own experimental packages), so the card is a view over local data: same data as the panel, but not part of the transcript.
- The card is **draggable** (grab the top bar). Drag it within 40px of the left or right edge and it **docks to that edge** as a narrow strip; click the strip to reopen. Position and docked state persist locally. `–` docks directly, `×` dismisses this delivery.

## Development

```bash
node test/engine.test.mjs            # engine unit tests (15)
node test/host.integration.mjs       # host integration against a temp DSH_HOME (~50s)
node test/midnight.integration.mjs   # cross-midnight catch-up with a faked clock (~45s)
```

MIT License.
