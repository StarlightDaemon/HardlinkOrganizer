# Hardlink Organizer — Docker image
# Minimal Python 3.11 base; all dependencies pinned via requirements.txt.
# Build from the Hardlink Organizer root:
#   docker build -f packaging/docker/Dockerfile -t hardlink-organizer:0.3.0 .
# Run:
#   docker run -p 7700:7700 -v /path/to/config:/config -e PUID=1000 -e PGID=1000 hardlink-organizer:0.3.0

FROM python:3.11-slim

LABEL org.opencontainers.image.title="Hardlink Organizer"
LABEL org.opencontainers.image.description="Safely plan and execute hardlinks across NAS storage pools with a preview-first web UI"
LABEL org.opencontainers.image.version="0.3.0"

# Non-root user for safety
RUN addgroup --system hlo && adduser --system --ingroup hlo hlo

# Install gosu for PUID/PGID privilege-drop entrypoint
RUN apt-get update && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer cache)
COPY ./requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY ./hardlink_organizer.py .
COPY ./engine/ ./engine/
COPY ./webapp/ ./webapp/
COPY ./config.example.toml .

# Data directory (db, logs) and config directory will be mounted from host
RUN mkdir -p /config /data && chown -R hlo:hlo /config /data

# Default environment
ENV HARDLINK_CONFIG=/config/config.toml
ENV PYTHONUNBUFFERED=1
ENV PUID=1000
ENV PGID=1000

EXPOSE 7700

# entrypoint.sh runs as root, remaps hlo UID/GID to PUID/PGID, chowns the
# writable mounts, then drops privilege via gosu before exec-ing the CMD.
COPY packaging/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["python", "webapp/run.py", "--config", "/config/config.toml", "--host", "0.0.0.0", "--port", "7700"]
