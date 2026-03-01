# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json ./
COPY services/openclaw/package.json services/openclaw/package.json

RUN npm install --workspaces --include-workspace-root

COPY services/openclaw services/openclaw

RUN npm run -w @openclaw/openclaw build

EXPOSE 8082
CMD ["npm", "run", "-w", "@openclaw/openclaw", "start"]
