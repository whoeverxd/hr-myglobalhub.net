#!/usr/bin/env bash
#
# Sube MGH Timekeeping al VPS y lo deja sirviendo. Correlo VOS, desde tu maquina.
#
#   bash docs/deployment/subir_codigo.sh            # EN SECO: dice que haria
#   bash docs/deployment/subir_codigo.sh --aplicar   # lo hace
#
# POR QUE EXISTE. Era el unico de los tres proyectos sin camino de salida: el SSO
# y MSH tienen script y por eso se publican; esto se desplegaba a mano con rsync,
# y lo que se hace a mano una vez se hace distinto la segunda. El codigo vivo del
# 2026-11-04 estaba fechado el 3-nov y el anterior el 29-oct, cada uno con su
# propia combinacion de pasos recordada de memoria.
#
# SON DOS DESTINOS Y DOS DUEÑOS, y confundirlos es el error caro:
#   el API    -> /srv/mgh-timekeeping/backend   (usuario mgh,       servicio mgh-api)
#   la web    -> /var/www/myglobalhub-hr        (usuario www-data,  lo sirve NGINX)
# El rsync corre como root y root ignora los permisos, asi que el dueño se
# restituye a mano despues de cada sincronizacion. Un archivo que queda de root
# en el arbol del API no lo puede leer el proceso, y el sintoma es un 500 que no
# menciona permisos en ninguna parte.
#
# LO QUE NUNCA VIAJA EN EL PAQUETE, y cada uno por su motivo:
#   .env            los secretos viven en el servidor, no en un paquete
#   config/         ahi vive la credencial de cuenta de servicio de Firebase.
#                   Se coloca UNA vez a mano. Reenviarla en cada deploy la
#                   pasea por /tmp y por el historial de la terminal sin
#                   necesidad. (Y hay una commiteada en el repo con una
#                   excepcion `!` en .gitignore: eso es un problema aparte, de
#                   rotacion, no de despliegue.)
#   data/           produccion RECONSTRUYE firestore_cache.json al arrancar.
#                   Mandar el snapshot local serviria datos atrasados en la
#                   ventana en que la hidratacion falle, que es justo cuando
#                   menos se quiere.
#   uploads/        las evidencias que sube la gente. No vienen del repo y no
#                   se reemplazan desde el repo.
#   node_modules/   lo instala `npm ci` alla, con el lock que si viaja
#   test/           produccion no corre tests
#   scratch-*.js    depuracion. Estan versionados, y eso hay que arreglarlo en
#                   el repo; mientras tanto no se publican.
set -uo pipefail

APLICAR=0
[ "${1:-}" = "--aplicar" ] && APLICAR=1

VPS=${VPS:-root@159.89.232.240}
LLAVE=${LLAVE:-$HOME/.ssh/mysocialhub_vps}
RUTA_API=/srv/mgh-timekeeping/backend
RUTA_WEB=/var/www/myglobalhub-hr
SERVICIO=mgh-api
# EL BUILD DEL FRONTEND NECESITA ESTA URL EXPLICITA. Sin ella Vite hornea el
# proxy de desarrollo (`/api` a localhost:5050) y el login del sitio publicado
# contesta 404. Es el error que ya se cometio una vez, y no deja rastro en el
# build: compila igual, se publica igual, y falla recien cuando alguien entra.
API_URL=${API_URL:-https://api.myglobalhub.net}
WEB_URL=${WEB_URL:-https://hr.myglobalhub.net}

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PAQ=/tmp/mgh-hr-deploy-$(date +%Y%m%d-%H%M%S).tgz
SELLO=$(date +%Y%m%d-%H%M%S)

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
mal()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
nota() { printf '  \033[90m%s\033[0m\n' "$*"; }
remoto() { ssh -i "$LLAVE" -o BatchMode=yes "$VPS" "$*"; }

[ "$APLICAR" -eq 1 ] || printf '\033[1;33mEN SECO\033[0m — nada se escribe. Agrega --aplicar para hacerlo.\n'

# ---------------------------------------------------------------- 1 · frontend
printf '\n\033[1;36m1 · Build del frontend\033[0m\n'
cd "$RAIZ/frontend" || { mal 'no existe frontend/'; exit 1; }
if [ "$APLICAR" -eq 1 ]; then
  VITE_API_URL="$API_URL" npm run build >/tmp/mgh-hr-build.log 2>&1 \
    && ok "build con VITE_API_URL=$API_URL" \
    || { mal 'el build fallo. Ultimas lineas:'; tail -15 /tmp/mgh-hr-build.log; exit 1; }
else
  nota "haria: VITE_API_URL=$API_URL npm run build"
  [ -d dist ] && nota "hay un dist/ previo del $(date -r dist '+%Y-%m-%d %H:%M'), se reemplazaria" \
              || nota 'no hay dist/ todavia'
fi

# LA COMPROBACION QUE ATRAPA EL ERROR DE LA URL, y mecanicamente: si el bundle
# no menciona el dominio del API, se horneo el proxy de desarrollo. Se mira el
# ARTEFACTO, no la variable de entorno: la variable puede estar bien y el build
# venir de una corrida anterior que no la tenia.
if [ -d dist ]; then
  if grep -rqF "$API_URL" dist/assets/*.js 2>/dev/null; then
    ok "el bundle apunta a $API_URL"
  else
    mal "el bundle NO menciona $API_URL: se horneo el proxy de desarrollo y el login va a dar 404"
    [ "$APLICAR" -eq 1 ] && exit 1
  fi
fi
cd "$RAIZ"

# ----------------------------------------------------------------- 2 · paquete
printf '\n\033[1;36m2 · Paquete del API\033[0m\n'
# LO QUE NO VIAJA SE DECIDE POR LA LISTA, NO POR EXCLUSIONES. Abajo se nombran
# exactamente las cinco cosas que suben; `data/`, `uploads/`, `config/`, `test/`
# y `.env` no estan ahi y por eso no entran. Esto no es un detalle de estilo:
# `--exclude='data'` parecia una red de seguridad barata y se come CUALQUIER
# directorio llamado `data` a cualquier profundidad, asi que dejaba afuera
# `scripts/data/wokokai-moderacion.js` —el plan de moderacion de Wokokai, que si
# es codigo del repo— y el rsync --delete lo habria BORRADO de produccion. Lo
# atrapo la primera corrida en seco, que es para lo que existe.
#
# Las exclusiones que quedan son las que pueden aparecer ANIDADAS dentro de
# src/ o scripts/, donde la lista no las filtra.
tar -czf "$PAQ" -C "$RAIZ/backend" \
  --exclude='node_modules' --exclude='.env' --exclude='.DS_Store' \
  src scripts server.js package.json package-lock.json 2>/dev/null \
  || { mal 'no se pudo armar el paquete'; exit 1; }

# EL CONTROL VA ANTES DE SUBIR, NO DESPUES. Y mira credenciales de Firebase
# ademas de .env: una cuenta de servicio no termina en `.key` ni se llama
# `.env`, asi que los patrones de los otros dos scripts no la atrapaban.
sucio=$(tar -tzf "$PAQ" | grep -iE '\.env|serviceaccount|adminsdk|firebase.*\.json|\.pem$|\.key$|cookies' || true)
if [ -n "$sucio" ]; then
  mal 'el paquete tiene algo sensible adentro. NO SE SUBE.'
  printf '%s\n' "$sucio" | sed 's/^/    /' | head
  exit 1
fi
n=$(tar -tzf "$PAQ" | wc -l | tr -d ' ')
ok "$n archivos, sin credenciales ($(du -h "$PAQ" | cut -f1))"

# -------------------------------------------------------- 3 · que cambiaria
printf '\n\033[1;36m3 · Que cambiaria en el VPS\033[0m\n'
remoto "rm -rf /root/mgh-hr-nuevo && mkdir -p /root/mgh-hr-nuevo" >/dev/null 2>&1
scp -i "$LLAVE" -o BatchMode=yes "$PAQ" "$VPS:/root/mgh-hr-deploy.tgz" >/dev/null 2>&1 \
  && remoto "tar -xzf /root/mgh-hr-deploy.tgz -C /root/mgh-hr-nuevo" >/dev/null 2>&1 \
  && ok 'paquete arriba y extraido APARTE (no sobre el arbol vivo)' \
  || { mal 'no se pudo subir/extraer'; exit 1; }

for d in src scripts; do
  salida=$(remoto "rsync -an --delete --out-format='%o %n' /root/mgh-hr-nuevo/$d/ $RUTA_API/$d/" 2>/dev/null)
  printf '  %-10s %s archivo(s) a sincronizar\n' "$d" "$(printf '%s\n' "$salida" | grep -cE '^(send|del\.)' || true)"
  borra=$(printf '%s\n' "$salida" | grep '^del\.' || true)
  [ -n "$borra" ] && printf '\033[33m    se BORRARIAN (ya no estan en el repo):\033[0m\n%s\n' "$(printf '%s\n' "$borra" | sed 's/^/      /')"
done

# Lo que sobra en el arbol vivo y NO se borra solo: la raiz va sin --delete a
# proposito (ahi viven .env, config/, data/ y uploads/), asi que un archivo
# retirado del repo sobrevive. Se informa en vez de borrarlo: quitar archivos de
# un servidor es una decision, no un efecto secundario.
sobra=$(remoto "ls -1 $RUTA_API/scratch-*.js 2>/dev/null | xargs -r -n1 basename" 2>/dev/null || true)
[ -n "$sobra" ] && { printf '  \033[33msobran en produccion (depuracion, se quitan a mano):\033[0m\n'; printf '%s\n' "$sobra" | sed 's/^/    /'; }

if [ -d "$RAIZ/frontend/dist" ]; then
  salida=$(rsync -an --delete --out-format='%o %n' -e "ssh -i $LLAVE -o BatchMode=yes" \
    "$RAIZ/frontend/dist/" "$VPS:$RUTA_WEB/" 2>/dev/null)
  printf '  %-10s %s archivo(s) a sincronizar\n' 'web' "$(printf '%s\n' "$salida" | grep -cE '^(send|del\.)' || true)"
  # EN SECO ESE NUMERO ES INDICATIVO Y NADA MAS, y conviene decirlo: el build no
  # corrio, asi que se comparo el `dist/` ANTERIOR contra produccion. Con
  # --aplicar el build se hace primero y los hashes de Vite cambian, asi que el
  # numero real sera mayor. Un conteo que parece exacto y no lo es es peor que
  # ninguno.
  [ "$APLICAR" -eq 0 ] && nota 'ese numero sale del dist/ anterior: el build no corrio todavia'
fi

if [ "$APLICAR" -eq 0 ]; then
  printf '\n\033[1;36m4 · Lo que harian los pasos restantes\033[0m\n'
  nota "respaldo en /root/respaldos/mgh-hr-$SELLO.tgz (API y web)"
  nota "rsync --delete de src/ y scripts/ · rsync SIN --delete de server.js y package*.json"
  nota "rsync --delete de frontend/dist -> $RUTA_WEB"
  nota "chown mgh:mgh en el API y www-data:www-data en la web"
  nota "npm ci --omit=dev  (4 dependencias; la unica de desarrollo es nodemon)"
  nota "systemctl restart $SERVICIO  — ESTO REHIDRATA desde Firestore (~2900 lecturas)"
  nota "verificacion: servicio activo, /api/health con hydration desde cloud-firestore y sin error, web 200"
  remoto "rm -rf /root/mgh-hr-nuevo /root/mgh-hr-deploy.tgz" >/dev/null 2>&1
  printf '\n  \033[33mEn seco. Nada se escribio. Corre con --aplicar cuando lo hayas leido.\033[0m\n'
  exit 0
fi

# ----------------------------------------------------------------- 4 · respaldo
printf '\n\033[1;36m4 · Respaldo del arbol remoto\033[0m\n'
remoto "mkdir -p /root/respaldos && tar -czf /root/respaldos/mgh-hr-$SELLO.tgz \
  --exclude=backend/node_modules -C /srv/mgh-timekeeping backend \
  && tar -czf /root/respaldos/mgh-hr-web-$SELLO.tgz -C /var/www myglobalhub-hr" \
  && ok "respaldo: /root/respaldos/mgh-hr-$SELLO.tgz (+ -web-)" \
  || { mal 'no se pudo respaldar. NO SIGAS.'; exit 1; }

# ------------------------------------------------------------ 5 · sincronizacion
printf '\n\033[1;36m5 · Sincronizacion\033[0m\n'
# --delete SOLO dentro de src/ y scripts/. En la RAIZ del backend nunca: ahi
# viven .env, config/ (la credencial), data/ (el cache que produccion
# reconstruye) y uploads/ (las evidencias). Un --delete ahi se los lleva, y el
# respaldo de arriba es lo unico que quedaria entre eso y perder evidencias.
remoto "rsync -a --delete /root/mgh-hr-nuevo/src/ $RUTA_API/src/ && \
  rsync -a --delete /root/mgh-hr-nuevo/scripts/ $RUTA_API/scripts/ && \
  rsync -a /root/mgh-hr-nuevo/server.js /root/mgh-hr-nuevo/package.json \
           /root/mgh-hr-nuevo/package-lock.json $RUTA_API/" >/dev/null 2>&1 \
  && ok "API sincronizado en $RUTA_API" || { mal 'la sincronizacion del API fallo'; exit 1; }
remoto "chown -R mgh:mgh $RUTA_API/src $RUTA_API/scripts $RUTA_API/server.js \
  $RUTA_API/package.json $RUTA_API/package-lock.json" >/dev/null 2>&1 \
  && ok 'dueño mgh:mgh restituido' || mal 'no se pudo restituir el dueño del API'

rsync -a --delete -e "ssh -i $LLAVE -o BatchMode=yes" "$RAIZ/frontend/dist/" "$VPS:$RUTA_WEB/" >/dev/null 2>&1 \
  && ok "web sincronizada en $RUTA_WEB" || { mal 'la sincronizacion de la web fallo'; exit 1; }
remoto "chown -R www-data:www-data $RUTA_WEB" >/dev/null 2>&1 \
  && ok 'dueño www-data:www-data restituido' || mal 'no se pudo restituir el dueño de la web'
remoto "rm -rf /root/mgh-hr-nuevo /root/mgh-hr-deploy.tgz" >/dev/null 2>&1

# ------------------------------------------------- 6 · dependencias y reinicio
printf '\n\033[1;36m6 · Dependencias y reinicio\033[0m\n'
# Como el usuario del servicio, no como root: `npm ci` escribe node_modules, y
# si queda de root el proceso no lo lee.
remoto "cd $RUTA_API && sudo -u mgh npm ci --omit=dev --no-audit --no-fund" >/dev/null 2>&1 \
  && ok 'npm ci --omit=dev' || { mal "npm ci fallo. Vuelta atras: tar -xzf /root/respaldos/mgh-hr-$SELLO.tgz -C /srv/mgh-timekeeping"; exit 1; }
remoto "systemctl restart $SERVICIO" && ok "$SERVICIO reiniciado" \
  || { mal "no se pudo reiniciar $SERVICIO"; exit 1; }

# ----------------------------------------------------------- 7 · verificacion
printf '\n\033[1;36m7 · Verificacion\033[0m\n'
fallas=0
remoto "systemctl is-active $SERVICIO" | grep -q '^active$' && ok "$SERVICIO activo" \
  || { mal "$SERVICIO NO esta activo"; fallas=$((fallas+1)); }

# LA HIDRATACION ES LA COMPROBACION QUE IMPORTA, y por eso /api/health la
# informa. Un arranque con la credencial rechazada NO se cae: cae al snapshot
# local y sigue contestando 200 con datos viejos. «El servicio esta activo» no
# distingue eso de un arranque sano; `hydration.source` si.
# `-o` A UN ARCHIVO Y NO A STDOUT, Y ESTO NO ES COSMETICO. `curl --retry`
# escribe el cuerpo de CADA intento. Entre `systemctl restart` y el momento en
# que node empieza a escuchar pasan unos 4 segundos, y en esa ventana NGINX
# contesta 502: con la salida a stdout, el HTML de ese 502 queda PEGADO delante
# del JSON bueno del reintento y el parseo falla. La primera corrida real de
# este script dio cuatro rojos por esto, con produccion perfectamente sana —y
# una verificacion que grita en falso es peor que ninguna, porque la proxima vez
# se mira por encima—. Con `-o`, el archivo se trunca en cada intento y solo
# sobrevive el ultimo cuerpo. `--fail` ademas hace que un 4xx cuente como error
# para el reintento en vez de entrar como contenido.
TMP_SALUD=$(mktemp); trap 'rm -f "$TMP_SALUD"' EXIT
curl -s --fail --retry 15 --retry-delay 2 --retry-all-errors --max-time 120 \
  -o "$TMP_SALUD" "$API_URL/api/health" 2>/dev/null
salud=$(cat "$TMP_SALUD" 2>/dev/null)
# SE PARSEA UNA VEZ Y A VARIABLES, no con una funcion que vuelva a leer el JSON
# por cada campo. Un `error: null` impreso con print() sale como el string
# "None", y comparar contra "None" es la clase de detalle que convierte un
# despliegue roto en un verde: aca el campo se normaliza a vacio en Python, que
# es donde se sabe que era null.
IFS=$'\t' read -r estado dialecto fuente cols docs err <<<"$(printf '%s' "$salud" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print('\t\t\t\t\t'); raise SystemExit
h = d.get('hydration') or {}
campos = [d.get('status'), d.get('dialect'), h.get('source'),
          h.get('collections'), h.get('docs'), h.get('error')]
print('\t'.join('' if c is None else str(c) for c in campos))
" 2>/dev/null)"

[ "$estado" = "ok" ] && ok "/api/health responde ok" || { mal "/api/health dijo «${estado:-nada}»"; fallas=$((fallas+1)); }
[ "$dialecto" = "firestore" ] && ok "dialecto firestore" || { mal "dialecto «${dialecto:-?}»: produccion no deberia correr en otro"; fallas=$((fallas+1)); }
if [ "$fuente" = "cloud-firestore" ] && [ -z "$err" ]; then
  ok "hidratado desde Firestore: $cols colecciones, $docs docs"
else
  mal "hidratacion desde «${fuente:-?}»${err:+ con error «$err»}: produccion sirve el SNAPSHOT VIEJO"
  nota 'la credencial de Firebase del servidor no se acepto. El sitio responde 200 con datos atrasados.'
  fallas=$((fallas+1))
fi

c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$WEB_URL/")
[ "$c" = "200" ] && ok "la web responde — $c" || { mal "la web dio $c"; fallas=$((fallas+1)); }
# Y que lo servido sea lo recien subido: el script de ENTRADA que nombra el
# index.html del build tiene que figurar en el index.html que sirve NGINX. Sin
# esto, un rsync que no copio nada se lee igual que uno que si.
#
# SE LEE DEL index.html LOCAL, no de `ls assets/*.js | head -1`. Eso elegia el
# primero por orden alfabetico —un chunk de vendor como `firebase-<hash>.js`—
# que Vite NO nombra en el index.html: lo importa el chunk de entrada. La
# comprobacion daba rojo siempre, con la web perfectamente actualizada.
entrada=$(grep -oE 'assets/[A-Za-z0-9._-]+\.js' "$RAIZ/frontend/dist/index.html" 2>/dev/null | head -1)
if [ -n "$entrada" ]; then
  curl -s --max-time 20 "$WEB_URL/" | grep -qF "$entrada" \
    && ok "la web sirve el bundle recien subido ($entrada)" \
    || { mal "el index.html servido no menciona $entrada: NGINX sirve una version anterior"; fallas=$((fallas+1)); }
else
  mal 'el index.html del build no nombra ningun script: el build quedo vacio?'; fallas=$((fallas+1))
fi

printf '\n'
if [ "$fallas" -eq 0 ]; then
  printf '  \033[32mMGH Timekeeping desplegado y verificado.\033[0m\n\n'
else
  printf '  \033[31m%s comprobacion(es) fallaron.\033[0m\n' "$fallas"
  printf '    \033[90mVuelta atras API: tar -xzf /root/respaldos/mgh-hr-%s.tgz -C /srv/mgh-timekeeping\033[0m\n' "$SELLO"
  printf '    \033[90mVuelta atras web: tar -xzf /root/respaldos/mgh-hr-web-%s.tgz -C /var/www\033[0m\n\n' "$SELLO"
fi
exit "$fallas"
