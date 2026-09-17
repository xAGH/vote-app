# ShowRoom Vote

App de votación y calificación para el ShowRoom de proyectos formativos ADSO
(SENA, Centro de Comercio y Turismo — Regional Quindío). Reemplaza el proceso
en papel de `Rubrica para ADSO.xlsx` por un flujo digital con tres roles:

- **Aprendiz visitante** — recorre el directorio de stands y vota cada
  proyecto una sola vez (4 criterios en estrellas). Solo puede votar si
  asistió ese día, verificado contra la asistencia real registrada en
  [Pulse](../pulse).
- **Jurado** (3 personas) — califica cada proyecto con la rúbrica oficial
  SENA (19 criterios en 6 bloques, escala 1–5, con autoguardado). La app
  calcula y muestra la nota; **la decisión de aprobación de etapa lectiva la
  toman los jurados fuera de la app.**
- **Administrador** — configura el evento, sincroniza asistencia, abre/cierra
  la votación y consulta los resultados.

Stack: Node.js + Express + EJS (server-rendered) + SQLite (`better-sqlite3`).
Un solo proceso, sin build step, pensado para correr en un portátil o
servidor on-premise el día del evento.

## Requisitos

- Node.js ≥ 20

## Instalación

```bash
npm install
cp .env.example .env   # y edita los valores
npm run seed:demo      # opcional: datos de ejemplo para probar
npm run dev            # http://localhost:3000
```

`npm run dev` usa `node --watch` (reinicia solo al guardar cambios).
`npm start` corre sin watch, para producción.

## Docker

```bash
cp .env.example .env   # obligatorio: NODE_ENV=production exige SESSION_SECRET real
docker compose up --build
```

Imagen multi-stage (`node:20-bookworm-slim`), usuario sin privilegios, healthcheck
en `GET /healthz` (verifica que SQLite responde). Los datos viven en el volumen
nombrado `showroom_data` (montado en `/app/data`), así que sobreviven a
`docker compose down` y a reconstruir la imagen — solo se pierden con
`docker compose down -v`.

Antes de sembrar datos de demo dentro del contenedor:

```bash
docker compose exec app node src/db/seed.js
```

Con `NODE_ENV=production` (ya fijado en la imagen), el servidor se niega a
arrancar si `SESSION_SECRET` falta o mide menos de 16 caracteres — es
intencional, falla rápido en vez de correr sin sesiones seguras.

## Variables de entorno

Ver `.env.example` para la lista completa y comentada. Las más importantes:

| Variable | Qué hace |
|---|---|
| `ADMIN_PASSWORD` | Contraseña del panel `/admin`. |
| `SESSION_SECRET` | Firma las cookies de sesión. Mínimo 16 caracteres, obligatorio en producción. |
| `EVENT_NAME`, `EVENT_DATE` | Nombre del evento y fecha (`AAAA-MM-DD`) usada para consultar asistencia. |
| `PULSE_API_URL`, `PULSE_API_KEY` | Credenciales M2M de Pulse (ver `~/code/pulse/docs/09-m2m-integrations.md`). |
| `PULSE_MOCK` | En `true`, no llama a Pulse: usa un roster de ejemplo. Útil para desarrollar sin Pulse levantado. |
| `NODE_ENV` | En `production` exige `SESSION_SECRET` y marca las cookies como `secure` (requiere HTTPS). |

La base de datos vive en `data/showroom.db` (SQLite, modo WAL). Se crea y
migra sola al arrancar — no hace falta un paso de migración manual.

## Runbook del día del evento

1. **Antes de abrir puertas**, con la app corriendo y accesible en la red del
   evento:
   - Entra a `/admin` con `ADMIN_PASSWORD`.
   - En **Proyectos**, carga los stands (número, nombre, ficha expositora,
     programa, equipo, resumen).
   - En **Fichas visitantes**, agrega las fichas que van a votar (nunca una
     ficha expositora: si coincide, esos aprendices quedan bloqueados para
     votar su propio stand, pero es más simple no cargarla).
   - En **Jurados**, crea a los 3 jurados. El PIN se muestra **una sola
     vez** — apúntalo y entrégalo en persona.
   - Confirma `EVENT_DATE` en **Panel** (la fecha que se usa para consultar
     asistencia en Pulse).

2. **Sincroniza asistencia** en **Fichas visitantes → Sincronizar todas**.
   Repite cuantas veces haga falta a medida que los instructores van
   registrando asistencia. Un aviso "Sin sesión hoy" significa que el
   instructor de esa ficha todavía no pasa lista — no significa que nadie
   asistió.

3. **Abre la votación** en **Panel**: activa "Voto de aprendices" y
   "Calificación de jurados" (pueden abrirse en momentos distintos).

4. **Durante el evento**: los aprendices entran por `/aprendiz` (ficha +
   documento) y los jurados por `/jurado` (nombre + PIN). Si llega una ficha
   que no sincronizó a tiempo, sincronízala de nuevo desde el panel — no
   hace falta reiniciar la app.

5. **Al cerrar**: cierra ambas votaciones desde **Panel** y revisa
   **Resultados** — ranking de aprendices (con desempate por cantidad de
   votos) y nota final de cada jurado. Descarga el CSV para el acta.

### Si Pulse no responde

La validación de asistencia se hace contra una **caché local** sincronizada
de antemano (paso 2), no contra Pulse en vivo en el momento del voto. Si
Pulse se cae a mitad del evento, los aprendices que ya estaban en la caché
siguen pudiendo entrar sin problema; solo una ficha nueva que nunca se
sincronizó quedaría bloqueada hasta que Pulse vuelva.

## Estructura del proyecto

```
src/
├── server.js         # arranque, middleware, sesiones
├── db/
│   ├── schema.sql     # esquema SQLite (la unicidad de voto vive aquí)
│   ├── index.js        # conexión + migración idempotente
│   └── seed.js          # datos de demostración (npm run seed:demo)
├── lib/
│   ├── rubric.js        # los 19 criterios de jurado + los 4 de aprendiz
│   ├── scoring.js         # promedios, nivel SENA, ranking
│   ├── pulse.js            # cliente M2M de Pulse + caché de asistencia
│   ├── auth.js               # sesiones, PIN hashing (scrypt), CSRF
│   └── flash.js                # mensajes de una sola vista
├── routes/            # public.js · apprentice.js · jury.js · admin.js
├── views/              # layout.ejs + vistas EJS por rol
└── public/              # styles.css, app.js, fuentes autoalojadas
```

## Diseño

El sistema visual ("Piso de Feria" — señalética de exposición: números de
stand, credenciales, chips de estado tipo sello) se construyó con el skill
Impeccable. El contrato de dirección vive como comentario HTML al inicio de
`src/views/layout.ejs`; el sistema de tokens (color, tipografía, sombras) en
`src/public/styles.css`. Ver `DESIGN.md` para el detalle documentado del
sistema construido.

## Seguridad

- Un voto por aprendiz por proyecto se hace cumplir con un índice `UNIQUE`
  en SQLite, no solo en la ruta.
- Sesiones firmadas (`httpOnly`, `sameSite: lax`), token CSRF en todos los
  formularios que escriben.
- Rate limiting en los formularios de ingreso (aprendiz, jurado, admin).
- PIN de jurado y contraseña de admin nunca se guardan en claro (`scrypt` +
  comparación en tiempo constante).
- `PULSE_API_KEY` solo se usa server-side, nunca llega al navegador.

## Fuera de alcance de este build

- Integración con Traefik (labels/router) y el túnel de Cloudflare para
  exponerla en el dominio del centro — la imagen Docker ya está lista para
  recibir esa capa, pero el cableado específico se hace en el servidor
  on-premise, no aquí.
- Pantalla pública de ranking en vivo, QR por stand, multi-evento.
