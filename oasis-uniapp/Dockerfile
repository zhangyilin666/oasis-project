FROM node:22-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV VITE_API_BASE_URL=""
RUN npm run build:h5

FROM caddy:2-alpine
COPY --from=build /build/dist/build/h5 /srv
