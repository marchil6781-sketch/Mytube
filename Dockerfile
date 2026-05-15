FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p uploads data

EXPOSE 3001

ENV PORT=3001
ENV JWT_SECRET=change-this-to-a-random-secret

CMD ["node", "server.js"]
