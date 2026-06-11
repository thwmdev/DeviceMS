# Giai đoạn 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Giai đoạn 2: Nginx
FROM nginx:alpine
# Copy file cấu hình mới
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy kết quả build
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]