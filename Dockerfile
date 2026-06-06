FROM node:22-bookworm-slim

WORKDIR /app

# Instalar bun globalmente
RUN npm install -g bun

# Copiar archivos de dependencias
COPY package.json bun.lock ./

# Instalar dependencias con bun
RUN bun install

# Copiar el resto del proyecto
COPY . .

# Asegurar que el entrypoint es ejecutable (por si viene sin el bit)
RUN chmod +x /app/entrypoint.sh

# Crear usuario no-root y dar permisos
RUN adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8788

# El entrypoint genera /app/.dev.vars desde variables de entorno
# (ARCANE_API_KEY, ARCANE_BASE_URL, MCP_AUTH_TOKEN) y luego ejecuta el CMD
ENTRYPOINT ["/app/entrypoint.sh"]

# Arrancar wrangler dev en modo local
CMD ["bunx", "wrangler", "dev", "--config", "wrangler.local.jsonc", "--port", "8788", "--ip", "0.0.0.0"]
