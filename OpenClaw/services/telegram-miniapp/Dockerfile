# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json ./
COPY services/telegram-miniapp/package.json services/telegram-miniapp/package.json

RUN npm install --workspaces --include-workspace-root

COPY services/telegram-miniapp services/telegram-miniapp

RUN npm run -w @openclaw/telegram-miniapp build

EXPOSE 8084
CMD ["npm", "run", "-w", "@openclaw/telegram-miniapp", "start"]
