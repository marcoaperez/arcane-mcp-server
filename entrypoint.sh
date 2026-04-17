#!/bin/sh
# Entrypoint para el MCP server.
#
# Wrangler dev lee las variables de entorno desde el archivo .dev.vars,
# no desde las variables de entorno estándar del contenedor. Este script
# genera .dev.vars al arrancar a partir de las variables de entorno que
# se le pasan al contenedor (via docker-compose, Arcane, env_file, etc.).
#
# Variables requeridas:
#   ARCANE_API_KEY   — API key de Arcane (obtener en Settings > API Keys)
#   ARCANE_BASE_URL  — URL base de Arcane (http://localhost:3552 cuando
#                      corre en la misma VM que Arcane)
#   MCP_AUTH_TOKEN   — Bearer token para autenticar clientes MCP
#                      (generar con: openssl rand -hex 32)

set -e

# Validar que las variables obligatorias están definidas
missing=""
for var in ARCANE_API_KEY ARCANE_BASE_URL MCP_AUTH_TOKEN; do
  eval "value=\$$var"
  if [ -z "$value" ]; then
    missing="$missing $var"
  fi
done

if [ -n "$missing" ]; then
  echo "[entrypoint] ERROR: variables de entorno requeridas no definidas:$missing" >&2
  echo "[entrypoint] Definelas en docker-compose.yml (environment:) o en Arcane envContent." >&2
  exit 1
fi

# Generar .dev.vars para wrangler
cat > /app/.dev.vars <<EOF
ARCANE_API_KEY=${ARCANE_API_KEY}
ARCANE_BASE_URL=${ARCANE_BASE_URL}
MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN}
EOF

echo "[entrypoint] .dev.vars generado. Iniciando wrangler..."

# Pasar control al comando original (CMD del Dockerfile)
exec "$@"
