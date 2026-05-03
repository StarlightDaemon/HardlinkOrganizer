# Hardlink Organizer — Portainer

This directory contains a Portainer **stack definition** for deploying Hardlink
Organizer through the Portainer CE or BE web UI.

The canonical Docker image is defined in `packaging/docker/Dockerfile`.

## Prerequisites

- Portainer CE 2.x or BE with a connected Docker environment
- A pre-built or registry-published image, **or** a Portainer environment with
  build access to the repository

## Deploying via Portainer UI

1. In Portainer, go to **Stacks → Add stack**.
2. Paste the contents of `stack.yml` into the web editor, or use the
   **Upload** option to upload `stack.yml` directly.
3. Set the following environment variables in the Portainer UI (under
   **Environment variables**) before deploying:

   | Variable | Description |
   |---|---|
   | `PUID` | Host user UID (`id -u`) |
   | `PGID` | Host user GID (`id -g`) |

4. Adjust volume paths in `stack.yml` to match your host filesystem before
   deploying.

5. Click **Deploy the stack**.

## Notes

- Portainer stack files use the same Docker Compose v3 schema as `docker-compose.yml`.
- The file is named `stack.yml` by Portainer convention.
- Restart policy `unless-stopped` is compatible with Portainer's stack lifecycle.

## Access

Open: `http://<host-ip>:7700`
