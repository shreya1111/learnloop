FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci

COPY client ./client
RUN npm run build --workspace client

FROM nginx:1.27-alpine
# The nginx image renders /etc/nginx/templates/*.template with envsubst at
# startup; filter to the one variable we template so nginx's own $uri/$host
# directives are left untouched.
ENV NGINX_ENVSUBST_FILTER="^API_UPSTREAM$"
ENV API_UPSTREAM="api:5000"
COPY client/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80
