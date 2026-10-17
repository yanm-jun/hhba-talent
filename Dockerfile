# HHBA public website (React + Node read-only private recruitment proxy)
FROM node:22-alpine AS build
WORKDIR /build
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
RUN cd apps/web && npm ci
COPY apps/web/ ./apps/web/
RUN cd apps/web && npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build /build/apps/web/dist/ ./dist/
COPY deploy/railway/web.mjs ./web.mjs
USER node
EXPOSE 8080
CMD ["node","/app/web.mjs"]
