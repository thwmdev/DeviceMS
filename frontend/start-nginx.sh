#!/bin/sh
set -eu

LISTEN_PORT="${PORT:-80}"

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen ${LISTEN_PORT};
EOF

if [ -n "${BACKEND_URL:-}" ]; then
cat >> /etc/nginx/conf.d/default.conf <<EOF

    location /api/ {
        proxy_pass ${BACKEND_URL}/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
EOF
fi

cat >> /etc/nginx/conf.d/default.conf <<'EOF'

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }
}
EOF

exec nginx -g "daemon off;"
