# SlopDarts

A self-hosted darts scoreboard for your home, garage, or darts room. Run it
on one computer and open it in a browser on your phone, tablet, or TV —
every screen follows the same match.

Connect an [Autodarts](https://autodarts.io) board for automatic scoring,
or tap the on-screen dartboard to score manually. Players, game history,
and the current match stay on your server. No SlopDarts account, cloud
service, or separate database is required.

- **Six game modes:** X01, Around The Clock, Cricket, Shanghai, Gotcha,
  and Bob's 27, with settings for the modes that support them.
- **A shared scoreboard:** refresh the page or join from another device
  without losing your place.
- **Players and stats:** save your regular players, choose their colours
  and sound themes, and track results over time.
- **Easy corrections:** edit a dart or undo a throw before continuing.
- **Automatic or manual scoring:** use your Autodarts board or play with
  an ordinary dartboard and enter throws yourself.

One installation runs **one shared match at a time**. Anyone who can reach
it can control the game and manage its data; there are no logins or
read-only spectator accounts. Use it on a trusted local network. See
[network access](#network-access-and-reverse-proxies) for remote access.

## Contents

- [Quickstart with Docker Compose](#quickstart-with-docker-compose)
- [Play your first game](#play-your-first-game)
- [Install without Docker](#install-without-docker)
- [Configuration](#configuration)
- [Docker Compose examples](#docker-compose-examples)
- [Updates and everyday commands](#updates-and-everyday-commands)
- [Backups and restoring data](#backups-and-restoring-data)
- [Network access and reverse proxies](#network-access-and-reverse-proxies)
- [Troubleshooting](#troubleshooting)
- [Players, stats and history](#players-stats-and-history)
- [Development and architecture](#development-and-architecture)
- [License](#license)

## Quickstart with Docker Compose

Docker packages the app and its dependencies together, so you do not need
Node.js installed on your host. You need:

- A computer or server that will stay on while you play.
- Docker with Compose. Follow the [Docker Compose installation guide](https://docs.docker.com/compose/install/)
  for your operating system, then make sure Docker is running.
- A copy of this repository. Clone it using the URL from the repository's
  **Code** menu, or download and extract its ZIP archive.
- A browser on the same network. An Autodarts board manager is optional
  and only needed for automatic scoring.

Open a terminal in the project folder — the one containing
`docker-compose.yml` — and run:

```bash
docker compose up -d --build
```

The first run downloads dependencies and builds the app, which can take a
few minutes. `-d` keeps it running in the background after you close the
terminal. This setup builds from the source you downloaded; it does not
pull a prebuilt SlopDarts image.

Open **[http://localhost:8501](http://localhost:8501)** on that computer.
From another device, replace `localhost` with the server's local IP address,
for example **http://192.168.1.10:8501**. `localhost` always means the device
you are currently using.

You should see the game mode selection screen. Continue with
[Play your first game](#play-your-first-game). If it does not load, check:

```bash
docker compose ps
docker compose logs --tail=100 slopdarts
```

The included Compose file saves data in a Docker **named volume** called
`game-state` (Docker normally prefixes it with the project name). A volume
is storage kept separately from the container, so recreating or updating
the container keeps your players and history. No `.env` file is required.

## Play your first game

1. **Choose how to score.** For Autodarts, click **Board URL Missing** in
   the header, enter your board manager's full address, and click
   **Save URL**. Use the same address you use to open the board manager,
   including `http://` or `https://` and any port, for example
   `http://192.168.1.50:3180`. Use your actual board's address, not the
   SlopDarts address. For manual scoring, skip this step.
2. **Choose a game mode.** Add players from the saved roster or use
   **Create & Add Player**. Use the arrows to set the throwing order.
3. **Check the settings.** Open **Edit settings** to adjust the game.
   Turn **Autoscoring** off if you are entering darts yourself; leave it
   on to use the connected board.
4. **Press Start Game.** With autoscoring on, SlopDarts asks the board to
   start detection and reset its reported throws. Remove any physical
   darts before beginning. In manual mode, tap the on-screen board to
   enter each throw.
5. **Review and continue.** Click a filled dart slot to correct it, or use
   **Undo Dart**. Press **Next Turn** when ready. With autoscoring on,
   removing all darts and letting the board return to its ready state
   also advances a completed turn.

Open the same SlopDarts address on a second device to share the scoreboard.
Mute sound on secondary devices using the speaker button during a game.
The mute setting belongs to that browser; game actions affect everyone.

To change the board address later, open the board status controls, click
the saved address, then **Edit URL**. Those controls also provide **Start**,
**Stop**, **Reset throws**, and **Calibrate** commands for the board.

## Install without Docker

Use this route if you already manage Node.js applications. Install a
[supported Node.js LTS release](https://nodejs.org/en/about/previous-releases)
with npm. Use **Node.js 24 LTS** (also used by Docker), or Node.js 22.12+
on the 22.x line. `.nvmrc` selects Node.js 24 for nvm users.
Download or clone the repository, open a terminal in its folder, then run:

```bash
npm ci
npm run build
npm start
```

Open **[http://localhost:3001](http://localhost:3001)**, or
`http://YOUR-SERVER-IP:3001` from another device. The server serves both the
built website and its API. Keep the terminal open; Ctrl+C stops it. For
unattended use, configure your operating system's service manager to run
`npm start` with the project folder as its working directory, or use Docker
Compose's restart policy.

Data is saved in `data/` inside the project folder by default. Keep the
whole project for this installation: `npm start` needs `server/`, `src/`,
`tsconfig.json`, dependencies, and the built `dist/` directory.

## Configuration

Most users only need to set the board address in the browser. These
optional environment variables are available for server configuration:

| Variable | Default | Purpose |
|---|---|---|
| `BOARD_URL` | Empty | Initial board manager address, including scheme and port if needed. A saved address in `board.json` takes precedence. |
| `PORT` | `3001` | Port the Node server listens on. In Docker, this is the port **inside** the container. |
| `DATA_DIR` | `./data` for Node; `/app/data` in Docker | Folder for the current match, roster, history, and saved board address. Must be writable by the server. |

For a direct Node installation, create a file named `.env` in the project
folder if you want to override defaults:

```dotenv
BOARD_URL=http://192.168.1.50:3180
PORT=3001
DATA_DIR=./data
```

Use your own board address. The server reads simple `KEY=value` lines and
whole-line `#` comments; existing process environment variables take
precedence. Restart the server after changing environment variables.

With the included Compose file, `.env` supplies **only `BOARD_URL`** to the
container. Setting `PORT` or `DATA_DIR` in that file alone does not change
Docker's ports or storage. Change the Compose file instead, as shown below,
and apply it with `docker compose up -d`.

Once an address has been saved through the app, changing `BOARD_URL` does
not replace it. Use **Edit URL** in the board controls to change the saved
value. There is no default board address or automatic board discovery.

## Docker Compose examples

### Default: Docker-managed storage

This is the setup included in [`docker-compose.yml`](docker-compose.yml):

```yaml
services:
  slopdarts:
    build: .
    ports:
      - "8501:3001"
    environment:
      BOARD_URL: ${BOARD_URL:-}
    volumes:
      - game-state:/app/data
    restart: unless-stopped

volumes:
  game-state:
```

## Raspberry Pi (arm64) builds

This project now supports building multi-architecture Docker images (amd64 + arm64) suitable for Raspberry Pi OS on arm64 devices.

- Local build helper: run the included script to build with Docker Buildx:

```bash
chmod +x scripts/build-multiarch.sh
./scripts/build-multiarch.sh <your-docker-username>/slopdarts:1.0.0 --push
```

- CI: a GitHub Actions workflow at `.github/workflows/build-and-push.yml` builds and pushes multi-arch images using Buildx. Provide the following repository secrets:
  - `DOCKERHUB_USERNAME` — your Docker Hub username
  - `DOCKERHUB_TOKEN` — a Docker Hub access token (not your account password)

- Compose on arm64: Docker images built for `linux/arm64` run natively on Raspberry Pi OS (64-bit). If you pull a prebuilt image on an arm64 host, Docker usually selects the correct platform automatically. If you need to force a platform in `docker-compose.yml`, add `platform: "linux/arm64"` under the service.

- Branching & Git practice: create a feature branch for these changes, for example `feature/arm64-builds`, open a PR against `main`, and include the CI secret setup in the PR description so reviewers can verify the workflow before merging.

The port mapping is `HOST:CONTAINER`: browse to port **8501** on your
server, while the app listens on **3001** inside Docker. To use port 8080
instead, change the mapping to `"8080:3001"`.

Keep this file in the repository root: `build: .` needs the Dockerfile and
source files alongside it. A Compose editor on a NAS or in Portainer also
needs access to that build context; pasting this YAML by itself is not a
complete installation.

### Alternative: store data in a visible folder

For a **new installation**, you can replace the Compose file with this
example to keep data in a `data` folder beside it:

```yaml
services:
  slopdarts:
    build: .
    ports:
      - "8501:3001"
    environment:
      BOARD_URL: ${BOARD_URL:-}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

This is a **bind mount**: a folder on the host appears inside the container.
Create the folder with `mkdir -p data` before starting. You can replace
`./data` with an absolute path on your server, such as
`/srv/slopdarts/data`. Ensure the container can write to it.

Switching an existing installation from a named volume to a bind mount
does **not** move its data. Back up the existing data first, then restore
it into the new storage before playing again.

## Updates and everyday commands

Run Compose commands from the same project folder each time.

| Task | Command |
|---|---|
| See container status | `docker compose ps` |
| Follow logs (Ctrl+C exits the log view) | `docker compose logs -f --tail=100 slopdarts` |
| Stop the app, keeping the container and data | `docker compose stop` |
| Start it again | `docker compose start` |
| Restart it | `docker compose restart` |
| Apply Compose changes or rebuild updated source | `docker compose up -d --build` |
| Remove the container and network, keeping the named volume | `docker compose down` |

**Do not use `docker compose down -v` unless you intend to delete the
named volume and its saved data.** Keep the project folder name consistent:
renaming it can cause Compose to select a new volume, making the app appear
empty while the original data still exists.

To update a Git installation, finish your match and
[back up your data](#backups-and-restoring-data), then run:

```bash
git pull --ff-only
docker compose up -d --build
```

If you downloaded a ZIP, replace the application source with the newer
copy while preserving your Compose configuration, `.env`, and data. Keep
the same Compose project name when using named volumes. This installation
builds locally, so `docker compose pull` alone does not update SlopDarts.

For a direct Node installation, stop the server, back up the data, update
the source, then run `npm ci`, `npm run build`, and `npm start` again.

An incompatible saved match schema starts a fresh match instead of
migrating the in-progress game. Finish games before updating and retain a
backup with the source version it belongs to if you need to roll back.

## Backups and restoring data

Back up the **whole data folder**. It contains:

| File | Contents |
|---|---|
| `state.json` | Shared match, game settings, and progress |
| `players.json` | Player roster, colours, and sound preferences |
| `history.json` | Recorded games used for history and statistics |
| `board.json` | Board address saved in the app |

Files are created as needed, so a new installation may not have all four.
Also keep your Compose file, any `.env` file, and a note of the source
version. Store a copy of backups on another device.

### Back up a Docker installation

The following copies the data from either storage example above. Use a
new backup folder name each time. Stop the app first so the files describe
the same point in time; use `stop`, not `down`, because copying requires
the container to still exist.

```bash
docker compose stop slopdarts
mkdir -p backups/before-update
docker compose cp slopdarts:/app/data/. ./backups/before-update/
docker compose start slopdarts
```

Check that the copy succeeded and that the backup contains the expected
JSON files before updating. See Docker's
[Compose copy reference](https://docs.docker.com/reference/cli/docker/compose/cp/)
for the command's options.

### Restore a Docker installation

Restoring overwrites saved files, so back up the current data first. Use a
backup compatible with the version you are running. With the container
stopped, copy the backup contents back into its data folder:

```bash
docker compose stop slopdarts
docker compose cp ./backups/before-update/. slopdarts:/app/data/
docker compose start slopdarts
```

On a new host, copy the project configuration and backup there first, then
run `docker compose create --build` to create the container before copying
in the data and starting it. Copying merges folders: if restoring over an
existing installation, files absent from the backup are not removed.

For a direct Node installation, stop the server and copy `DATA_DIR`
(`data/` by default) to your backup location. To restore, replace that data
folder with the backup, ensure it is writable by the server, then restart.

## Network access and reverse proxies

Browsers connect to SlopDarts; **only the SlopDarts server connects to the
board manager**. The server or container therefore needs to reach the
board's address, even if your phone can already open it.

For access within your home, use the server's local IP address and allow
the chosen host port through its firewall. Inside a container, `localhost`
refers to that container. If the board manager runs on the same physical
host, use a host LAN address reachable from Docker instead.

SlopDarts has no built-in authentication or HTTPS. Anyone with access can
change the board URL, control the board, edit players, and clear history.
For access away from home, use a private VPN or an authenticated HTTPS
reverse proxy. Keep the app's direct port private so it cannot bypass the
proxy's access controls.

If you already run a reverse proxy, give SlopDarts its own hostname at `/`,
such as `darts.example.com`. Hosting under a path like `/slopdarts/` is not
supported by the current absolute asset and API paths. Forward the entire
site, including `/api`, to the app.

Live updates use **server-sent events (SSE)** at `/api/game/stream`.
Disable proxy buffering and allow long-lived responses. For example,
inside an existing Nginx server block on the same host as Docker:

```nginx
location / {
    proxy_pass http://127.0.0.1:8501;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_read_timeout 3600s;
}
```

This snippet only configures forwarding; configure your hostname, TLS,
and authentication in the enclosing proxy setup. The buffering and timeout
settings are documented in the [Nginx proxy reference](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).
For a proxy on the host, bind the Compose port to `"127.0.0.1:8501:3001"`
to restrict direct access to that host. A proxy in another container needs
a shared Docker network and an upstream such as `http://slopdarts:3001`;
its own `127.0.0.1` will not reach this container.

## Troubleshooting

| Symptom | What to check |
|---|---|
| The page will not load | Docker uses port **8501** by default; direct Node uses **3001**. On another device, use the server's IP, not `localhost`. Check `docker compose ps`, logs, and the host firewall. |
| Docker reports the port is already allocated | Another service uses port 8501. Change the left side of the Compose port mapping, then run `docker compose up -d`. |
| `docker compose` is unavailable or cannot connect to Docker | Install Compose, start Docker, and make sure your user has permission to use it. |
| Board URL Missing | Save the board manager URL through the status control, or turn Autoscoring off on the player setup screen for manual play. |
| Board is Offline | Check the saved URL, scheme, and port; confirm the board manager is running and reachable from the server/container. If a `.local` hostname does not resolve there, try the board's LAN IP. |
| Changing `BOARD_URL` has no effect | A URL saved in `board.json` takes precedence. Use **Edit URL** in the board controls. |
| The game says “Hold on!” or ignores new darts | Remove all darts and wait for the board to be empty and ready. Check detection in the board controls. Leftover darts are deliberately ignored until takeout finishes. |
| The screen reconnects repeatedly or updates arrive late through a proxy | Forward `/api/game/stream`, disable buffering, and increase the proxy's read timeout. Compare with direct local access to the app. |
| No sound | Click or tap the page once to allow browser audio, then check the in-game mute button and device volume. Mute is saved per browser. |
| Data is missing after recreating the container | Check the volume or bind mount and Compose project name. A new project name can select an empty volume. Look for `Could not save` errors in logs. |
| The current match disappeared after an update | An incompatible saved match schema is reset. Check logs for the saved-state warning and use a compatible backup if needed. |
| `npm start` runs but no website appears | Run `npm run build` first, then restart from the project root so the server finds `dist/`. |

When reporting a problem, include the source version or Git commit,
installation method, host OS, what you expected, reproduction steps, and
relevant logs. For board issues, include whether the board manager is
reachable from the SlopDarts host. Remove credentials and personal details
before sharing logs or configuration.

## Players, stats and history

- **Roster.** Players are a shared roster (`data/players.json`),
  not names retyped each match. The **Players** button on the home screen
  manages them; the setup screen picks from them and sets throw order.
- **Turn themes.** Each player gets a colour theme — ten named presets
  (Ocean, Emerald, Amber, Crimson, Violet, Magenta, Teal, Tangerine, Lime,
  Ice) or a custom colour, which derives its own matching accent. When it's
  someone's turn the whole app takes their colour: the page background
  shifts to a deep wash of it, cards pick up the same hue, their score
  panel fills with their gradient, and a thick frame rings the viewport —
  so you can tell whose turn it is from across the room without reading
  anything. The background tint is deliberately dark; the cards and text
  still have to be legible on top of it.
- **History.** Every match is recorded to `data/history.json` when it ends
  (`GET /api/history`, **History** button). Matches abandoned after at
  least one dart are kept too, flagged as not completed, so their darts
  still count toward stats without counting as anyone's win.
- **Stats are derived, never stored twice.** A record holds each player's
  per-game figures, and lifetime numbers are rolled up from those on
  demand — so stats can't drift out of sync with the games they came from.
  Each game module owns its own stat maths (`statsFromProgress`,
  `aggregateStats`, `recordSummary`), which is why X01 reports a 3-dart
  average and best turn while ATC reports hit % and targets cleared.
- Records snapshot each player's name and colour, so renaming or deleting
  a player later leaves past games intact. Deleting is blocked while
  they're in a running match.

## Development and architecture

Install the locked dependencies with `npm ci`, then run `npm run dev`.
The API listens on port 3001 and Vite serves the development site at
http://localhost:5173, proxying `/api` to the server. Run `npm run typecheck`
after changes and `npm run build` before distributing a release.

See [AGENTS.md](AGENTS.md) for contribution conventions and the game-module
integration guide.

The app keeps the match on the server rather than in a single browser. The
client only renders the latest state from the server, so refreshes and second
screens stay in sync without duplicating game logic. The server polls the board
once, applies throws once, and pushes the result out over SSE.

Game rules live inside modules under `src/games/` and are registered in
`src/games/registry.ts`. The reducer stays generic; no UI or server code
branches on a specific mode. That keeps adding or changing a game scoped to
its own module rather than spreading the logic across the app.

## Scope

The app deliberately does not include multi-leg X01, double-in, bots, or
avatars. The per-player turn colour already identifies everyone at a distance,
which keeps the UI simple and the board view readable from across the room.

## Board coordinate convention

`/api/state` reports each throw with a `coords` pair. Those values are centred
on the bull and normalised to 1.0 at the outer double wire, with x right and y
up. SVG flips the y-axis in `Dartboard.tsx`, otherwise markers land in the wrong
quadrant. The board firmware has also been observed to report `connected: false`
while actively detecting throws, so the status chip relies on `status`/`event`
instead of `connected` alone.

## Darts left in the board

A turn can end while darts are still physically in the board. The state machine
tracks `awaitingTakeout` and ignores leftover darts until the board is empty and
back in its ready `Throw` state. Completed visits stay editable until the player
presses **Next Turn** or takeout finishes and the board is clear.

## Sounds

Game events play a sound, and the server sends them with sequence numbers so
all devices play the same event once and reloads do not replay stale sounds.
The `public/sounds/` folder includes local `.wav` and `.ogg` packs, and the app
falls back to generated tones if any file is missing. Browsers only unlock audio
after a click or keypress.

Third-party asset and browser dependency notices are included in
[`public/THIRD_PARTY_NOTICES.txt`](public/THIRD_PARTY_NOTICES.txt) and copied
into the production build.

## License

SlopDarts is licensed under the **GNU General Public License v3.0 only**
(`GPL-3.0-only`). See [LICENSE](LICENSE) for the full terms. Third-party
dependencies and sound assets retain the licenses described in
[third-party notices](public/THIRD_PARTY_NOTICES.txt).
