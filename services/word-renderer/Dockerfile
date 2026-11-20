FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOME=/tmp
RUN apt-get update -qq && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      libreoffice-writer poppler-utils fonts-noto-cjk fontconfig && \
    rm -rf /var/lib/apt/lists/* && \
    pip install --no-cache-dir pillow==11.3.0 && \
    useradd --system --uid 10021 --home /tmp hhba
WORKDIR /app
COPY apps/web/scripts/word-layout-preservation.qa.py /app/word_layout.py
COPY services/word-renderer/server.py /app/server.py
USER 10021:10021
EXPOSE 8080
CMD ["python","-I","/app/server.py"]
