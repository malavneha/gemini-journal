FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["bun", "run", "dist/server.cjs"]