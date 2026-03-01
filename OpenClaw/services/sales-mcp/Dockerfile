# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY services/sales-mcp/package.json services/sales-mcp/package.json

RUN npm install --workspaces --include-workspace-root

COPY packages/shared-types packages/shared-types
COPY services/sales-mcp services/sales-mcp

RUN npm run -w @openclaw/shared-types build && npm run -w @openclaw/sales-mcp build

EXPOSE 8081
CMD ["npm", "run", "-w", "@openclaw/sales-mcp", "start"]
