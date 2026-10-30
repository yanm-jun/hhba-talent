FROM oven/bun:1.3
WORKDIR /app
COPY package.json ./
RUN bun install --production
COPY railway-function-20261018.ts ./server.ts
COPY jd-sync-store.mjs jd-sync-worker.mjs ./
COPY jd-sync-store.mjs ./jd-sync-store.mjs
COPY jd-sync-runner.mjs ./jd-sync-runner.mjs
COPY number-locked-translation.mjs ./number-locked-translation.mjs
# Railway Functions resolve versioned imports; standard Bun needs package names.
RUN sed -i 's/"html-to-text@9"/"html-to-text"/;s/"sanitize-html@2"/"sanitize-html"/' server.ts
ENV NODE_ENV=production
EXPOSE 8080
CMD ["bun", "run", "server.ts"]
