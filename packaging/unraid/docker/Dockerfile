# Hardlink Organizer — Docker image
# Minimal Python 3.11 base; all dependencies pinned via requirements.txt.
# Build from the Hardlink Organizer root:
#   docker build -f packaging/unraid/docker/Dockerfile -t hardlink-organizer:0.3.0 .
# Run:
#   docker run -p 7700:7700 -v /mnt/user/appdata/hardlink-organizer:/config -v ... hardlink-organizer:0.3.0

FROM python:3.11-slim

LABEL org.opencontainers.image.title="Hardlink Organizer"
LABEL org.opencontainers.image.description="Safely inventory ingress content and hardlink media payloads on Unraid"
LABEL org.opencontainers.image.version="0.3.0"

# Non-root user for safety
RUN addgroup --system hlo && adduser --system --ingroup hlo hlo

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

# Switch to non-root
USER hlo

# Default environment
ENV HARDLINK_CONFIG=/config/config.toml
ENV PYTHONUNBUFFERED=1

EXPOSE 7700

# Entrypoint: launch from CLI so --config can be overridden via CMD or env
ENTRYPOINT ["python", "webapp/run.py"]
CMD ["--config", "/config/config.toml", "--host", "0.0.0.0", "--port", "7700"]
