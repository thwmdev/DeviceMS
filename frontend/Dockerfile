# Giai đoạn 1: Build
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Giai đoạn 2: Nginx
FROM nginx:alpine
# Copy file cấu hình mới
# Copy kết quả build
COPY --from=build /app/dist /usr/share/nginx/html
COPY start-nginx.sh /usr/local/bin/start-nginx.sh
RUN chmod +x /usr/local/bin/start-nginx.sh
EXPOSE 80
CMD ["/usr/local/bin/start-nginx.sh"]
