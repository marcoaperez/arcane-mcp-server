FROM node:20-bookworm-slim

WORKDIR /app

# Instalar bun globalmente
RUN npm install -g bun

# Copiar archivos de dependencias
COPY package.json bun.lock ./

# Instalar dependencias con bun
RUN bun install

# Copiar el resto del proyecto
COPY . .

# Crear usuario no-root y dar permisos
RUN adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8788

# Arrancar wrangler dev en modo local
CMD ["bunx", "wrangler", "dev", "--config", "wrangler.local.jsonc", "--port", "8788", "--ip", "0.0.0.0"]
