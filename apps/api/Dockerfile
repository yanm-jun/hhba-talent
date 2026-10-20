FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv/hhba
RUN groupadd --gid 10001 hhba && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin hhba
COPY pyproject.toml ./pyproject.toml
RUN pip install --no-cache-dir .
COPY app ./app
USER 10001:10001
CMD ["python", "-m", "app.docling_worker"]
