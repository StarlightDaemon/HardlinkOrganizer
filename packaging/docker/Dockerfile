# Hardlink Organizer — Docker image
# Build from the Hardlink Organizer root:
#   docker build -f packaging/docker/Dockerfile -t hardlink-organizer:v1.0.0-rc.1 .

# --- Stage 1: build the React frontend ---
FROM node:20-slim AS frontend-builder

WORKDIR /app/webapp/frontend

COPY ./webapp/frontend/package*.json ./
RUN npm ci

COPY ./webapp/frontend/ ./
RUN npm run build

# --- Stage 2: production Python image ---
FROM python:3.11-slim

LABEL org.opencontainers.image.title="Hardlink Organizer"
LABEL org.opencontainers.image.description="Safely plan and execute hardlinks across NAS storage pools with a preview-first web UI"
LABEL org.opencontainers.image.version="1.0.0-rc.1"

# Non-root user for privilege-drop at runtime
RUN addgroup --system hlo && adduser --system --ingroup hlo hlo

# gosu for PUID/PGID privilege-drop entrypoint
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

# Drop in the built frontend from stage 1
COPY --from=frontend-builder /app/webapp/static/dist ./webapp/static/dist

# Writable mounts will come from the host
RUN mkdir -p /config /data && chown -R hlo:hlo /config /data

ENV HARDLINK_CONFIG=/config/config.toml
ENV PYTHONUNBUFFERED=1
ENV PUID=1000
ENV PGID=1000

EXPOSE 7700

COPY packaging/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["python", "webapp/run.py", "--config", "/config/config.toml", "--host", "0.0.0.0", "--port", "7700"]
