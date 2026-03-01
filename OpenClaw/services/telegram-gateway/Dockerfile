# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json ./
COPY services/telegram-gateway/package.json services/telegram-gateway/package.json

RUN npm install --workspaces --include-workspace-root

COPY services/telegram-gateway services/telegram-gateway

RUN npm run -w @openclaw/telegram-gateway build

EXPOSE 8083
CMD ["npm", "run", "-w", "@openclaw/telegram-gateway", "start"]
