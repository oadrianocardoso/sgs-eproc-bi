# Dockerfile para SGS-EPROC-BI (BI Oráculo)
# Multi-stage build para otimização

# Etapa 1: Build da aplicação
FROM node:24-alpine as build-stage

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar o restante dos arquivos do projeto
COPY . .

# Build do projeto (gera a pasta /dist)
RUN npm run build

# Etapa 2: Servidor de produção usando Nginx
FROM nginx:stable-alpine as production-stage

# Copiar os arquivos gerados no build para o diretório do Nginx
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Configuração simples para suportar rotas do React (SPA)
RUN echo 'server { \
    listen 80; \
    location /rest/ { \
        proxy_pass http://api-gateway:3000; \
        proxy_http_version 1.1; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
    location /tjsp-api/ { \
        proxy_pass http://api-gateway:3000; \
        proxy_http_version 1.1; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
