FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev

COPY server ./server
USER node

EXPOSE 5000
CMD ["npm", "run", "start", "--workspace", "server"]
