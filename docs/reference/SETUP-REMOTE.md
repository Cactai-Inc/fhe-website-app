# Remote Development Setup — Mac mini host, laptop + phone from anywhere

Goal: the **Mac mini at home** is the always-on host (code, dev server, Claude
Code session). The **laptop uses real VS Code** (via Remote-SSH into the mini),
and the **phone** reaches it through a browser. All three connect over
**Tailscale** so it works from anywhere, securely, with no port-forwarding.

> Both machines use the macOS account short name **`cj`** so all paths
> (`/Users/cj`, `~/.claude/projects/-Users-cj/...`) match across devices.

---

## The model

```
        ┌──────────────── Tailscale (private mesh, works anywhere) ───────────────┐
        │                                                                          │
   [ Laptop ]  VS Code Remote-SSH ─────────►  [ Mac mini ]  ◄───── browser ── [ Phone ]
   real VS Code, but files/terminal/         always-on host:        view site +
   extensions/Claude run on the mini         code, dev server,      drive Claude
                                             Claude session         (claude.ai/code)
```

You never move the project or the Claude thread — the laptop and phone are
windows into the one host.

---

## Step 1 — Mac mini (host)

1. **Prevent sleep** — System Settings → Energy →
   **"Prevent automatic sleeping when the display is off"** ON. (A sleeping mini
   is unreachable.) Consider also `caffeinate -s` if running long jobs.
2. **Enable SSH** — System Settings → General → **Sharing** → **Remote Login** ON.
   Allow access for `cj` (or "All users").
3. **Install Tailscale** — https://tailscale.com/download → install → sign in with
   the account you'll use on all three devices. The mini appears on your tailnet
   with a name (e.g. `mac-mini`). Find it: `tailscale status` or the menu-bar app.
4. **Get the code** (after it's pushed to GitHub):
   ```bash
   git clone https://github.com/Cactai-Inc/fhe-website-app.git
   cd fhe-website-app
   npm install
   # recreate .env (not in git) — copy the two values from the other machine:
   #   VITE_SUPABASE_URL=...
   #   VITE_SUPABASE_ANON_KEY=...
   npm run dev   # serves on http://localhost:5173 (and to the tailnet)
   ```
   To reach the dev server from other devices, bind it to the network:
   ```bash
   npm run dev -- --host    # now reachable at http://mac-mini:5173 over Tailscale
   ```

## Step 2 — Laptop (real VS Code via Remote-SSH)

1. **Install Tailscale**, sign in with the **same** account.
2. **VS Code** → install the **Remote - SSH** extension (Microsoft).
3. Command Palette (`Cmd+Shift+P`) → **Remote-SSH: Connect to Host…** →
   `cj@mac-mini` (use the Tailscale machine name).
4. Open the repo folder on the mini (`~/…/fhe-website-app` or wherever you cloned).
5. In the **Remote window**, install the **Claude Code** extension (VS Code installs
   extensions per-remote-host). Now Claude runs *on the mini* — same host, same
   sessions, not a copy.

> The editor UI is local (real VS Code on the laptop); the workspace, terminal,
> git, dev server, and Claude all execute on the mini.

## Step 3 — Phone

1. **Install Tailscale**, same account.
2. **View the site** — browser → `http://mac-mini:5173` (run the dev server with
   `--host` as above, or use the production preview).
3. **Drive Claude** — open **claude.ai/code** in the phone browser and connect to
   the mini's session (remote control). This is the right tool for phone access.

---

## Why this solves the "one thread everywhere" problem

The Claude Code session lives on the mini (`~/.claude/projects/-Users-cj/…`). The
laptop (Remote-SSH) and phone (browser) both connect to **that one host**, so
there's a single real thread — no copying `.jsonl` files, no stale snapshots.
Matching `cj` accounts keep every path identical across machines.

## Caveats / good-to-know

- The **mini must be powered on, awake, and running Tailscale** to be reachable.
- First Remote-SSH connect installs a small VS Code server on the mini (automatic).
- If `mac-mini` doesn't resolve, use its Tailscale IP (`100.x.x.x`, from
  `tailscale status`).
- Keep the mini updated and the `cj` account password strong — Remote Login is a
  real login surface (Tailscale keeps it off the public internet, which is the
  point).
- For headless reliability, you can enable **auto-login** for `cj` on the mini so
  it returns to a usable state after a power blip.
