# mirror.gcr.io — обход лимита Docker Hub (429) на новых VPS без docker login
FROM mirror.gcr.io/library/nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html

EXPOSE 80
