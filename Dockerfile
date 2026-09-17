FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY tools/build.mjs ./tools/build.mjs
RUN npm run build

FROM node:24.19.0-bookworm-slim AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM runtime AS game
COPY --from=build /app/build/game.mjs ./build/game.mjs
COPY --from=build /app/build/viewer ./build/viewer
CMD ["node","build/game.mjs"]

FROM runtime AS player
COPY --from=build /app/build/player.mjs ./build/player.mjs
COPY --from=build /app/build/llm-player.mjs ./build/llm-player.mjs
COPY --from=build /app/build/diagnostic-player.mjs ./build/diagnostic-player.mjs
CMD ["node","build/player.mjs"]
