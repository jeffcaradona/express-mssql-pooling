# Base stage
FROM node:22 AS base
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY ./src ./src
COPY ./public ./public

# Production stage
FROM node:22-slim
WORKDIR /app
COPY --from=base /app /app
CMD ["node", "./src/server.js"]
