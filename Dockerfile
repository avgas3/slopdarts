# --- Build the client ---------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Run the server (serves the client + owns the game state) -----------
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# The server imports the shared game rules out of src/, so both ship.
COPY tsconfig.json ./
COPY server ./server
COPY src ./src
COPY LICENSE ./
COPY --from=build /app/dist ./dist

ENV PORT=3001 \
    DATA_DIR=/app/data

EXPOSE 3001
CMD ["node", "--import", "tsx", "server/index.ts"]
