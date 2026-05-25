FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev 2>/dev/null || npm install --production
COPY --from=builder /app/dist ./dist

RUN mkdir -p /tmp/uploads

EXPOSE 8080
CMD ["node", "dist/index.js"]
