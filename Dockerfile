FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY worker/package.json ./worker/package.json

RUN npm install

COPY . .

RUN npm run db:generate && npm run worker:build

CMD ["npm", "run", "worker:start"]

