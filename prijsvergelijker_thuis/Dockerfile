# Vaste Debian-basis: Playwright/Chromium heeft glibc nodig. De Supervisor geeft zelf een
# Alpine-image mee via BUILD_FROM; die gebruiken we daarom bewust niet.
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt \
 && playwright install --with-deps chromium \
 && rm -rf /var/lib/apt/lists/*

COPY app /app
WORKDIR /app
CMD ["python3", "/app/main.py"]
