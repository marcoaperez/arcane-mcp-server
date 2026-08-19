#!/usr/bin/env bash
# Ejecuta la suite e2e desde vm-control, en la misma LAN que Arcane, en vez de
# a traves de Tailscale. Medido 2026-08-19: desde el Mac se cae el 16,7% de las
# peticiones (50 de 60); desde vm-control, 0 de 120.
#
# Se instala con bun (bun.lock es el unico lockfile del proyecto) pero se
# EJECUTA con node: bajo el runtime de bun, `zod` no resuelve y
# src/tools/gitops-syncs.ts revienta al importar con
# "undefined is not an object (evaluating 'z.string')".
set -uo pipefail

REMOTO=VM-Control
DESTINO=/root/arcane-mcp-e2e
IMG_INSTALL=oven/bun:1-alpine
IMG_RUN=node:24-alpine

reintenta() {
  local intentos=$1; shift
  local i
  for ((i = 1; i <= intentos; i++)); do
    if "$@"; then return 0; fi
    echo ">> intento $i/$intentos fallido, reintentando" >&2
    sleep 2
  done
  echo ">> agotados $intentos intentos" >&2
  return 1
}

copia() {
  # Se borra src/ antes de copiar: si un fichero se renombra o se elimina en
  # local, el tar por si solo dejaria el viejo ahi y la suite correria codigo
  # que ya no existe.
  ssh -o ConnectTimeout=20 "$REMOTO" "rm -rf '$DESTINO/src' && mkdir -p '$DESTINO'" || return 1
  # COPYFILE_DISABLE y --exclude='._*': el tar de macOS emite ficheros
  # AppleDouble que vitest intenta transformar y reporta como suites rotas.
  # node_modules se excluye ademas por arquitectura: el de macOS trae
  # binarios de esbuild para darwin que no corren en el contenedor.
  COPYFILE_DISABLE=1 tar --exclude='._*' --exclude=node_modules --exclude=.git --exclude=.wrangler -cf - . \
    | ssh -o ConnectTimeout=20 "$REMOTO" "tar -xf - -C '$DESTINO'" || return 1
  # El tar conserva el 0644 del Mac y .dev.vars lleva la clave de API.
  ssh -o ConnectTimeout=20 "$REMOTO" "chmod 600 '$DESTINO/.dev.vars'"
}

instala() {
  ssh -o ConnectTimeout=20 "$REMOTO" "docker run --rm --network host \
    -v '$DESTINO':/app -w /app $IMG_INSTALL \
    sh -lc 'bun install --frozen-lockfile'" >/dev/null
}

echo ">> Copiando el arbol de trabajo a $REMOTO:$DESTINO"
reintenta 10 copia || exit 1

echo ">> Instalando dependencias con $IMG_INSTALL"
reintenta 10 instala || exit 1

echo ">> Ejecutando la suite dentro de $IMG_RUN (red del host)"

# La corrida NO se reintenta cuando la suite ha llegado a ejecutarse: repetirla
# enmascararia un fallo real. Solo se reintenta cuando ssh ni siquiera logro
# conectar (exit 255 y ninguna linea de resumen de vitest), que es una caida
# del enlace y no un resultado.
for intento in 1 2 3 4 5 6 7 8 9 10; do
  salida=$(ssh -o ConnectTimeout=20 "$REMOTO" "docker run --rm --network host \
    -v '$DESTINO':/app -w /app \
    -e ARCANE_BASE_URL=http://localhost:3552 \
    $IMG_RUN sh -lc '
      set -a; . ./.dev.vars; set +a
      npx vitest run --config vitest.e2e.config.ts --reporter=verbose
    '" 2>&1)
  rc=$?
  if [ "$rc" -ne 255 ] || printf '%s' "$salida" | grep -q "Test Files"; then
    printf '%s\n' "$salida"
    exit "$rc"
  fi
  echo ">> ssh no llego a conectar (intento $intento/10), la suite no llego a correr" >&2
  sleep 2
done
echo ">> agotados 10 intentos de conexion" >&2
exit 1
