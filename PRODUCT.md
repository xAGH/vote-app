# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Node.js + Express, server-rendered HTML (EJS), SQLite (better-sqlite3), JS mínimo en el
cliente solo para mejoras progresivas (autoguardado del jurado, promedio en vivo). Un solo
proceso, sin build step ni framework de frontend. Elegido por el usuario explícitamente para
poder correr en un portátil o servidor on-premise sin dependencias externas el día del evento.

## Users

Tres roles, todos en el mismo evento presencial (un ShowRoom de proyectos formativos del
programa ADSO en el Centro de Comercio y Turismo, SENA Regional Quindío):

- **Aprendiz visitante:** viene de una ficha distinta a la que expone. Recorre los stands de
  pie, celular en mano, a menudo con poca batería y en un salón ruidoso. Entra, se identifica
  una vez, vota cada stand que visita y sigue caminando. Sesión de segundos por stand.
- **Jurado (3 personas):** evalúa cada proyecto con la rúbrica oficial SENA, tableta o
  portátil en mano, moviéndose de stand en stand o sentado en un punto fijo. Sesión de varios
  minutos por proyecto, con interrupciones (le hacen una pregunta, atiende a otro grupo).
- **Administrador (organizador del evento):** configura el evento antes de que empiece,
  sincroniza asistencia, y consulta resultados al cierre. Usa un portátil, sesión larga y sin
  prisa.

## Product Purpose

Reemplazar el proceso en papel (`Rubrica para ADSO.xlsx`) con el que hoy se califican los
proyectos formativos del ShowRoom. Existen dos calificaciones independientes:

1. **Voto del público (aprendices visitantes):** determina qué equipo se lleva el premio.
2. **Nota del jurado:** es la calificación oficial del proyecto formativo; los jurados la usan
   para decidir si el equipo aprueba su etapa lectiva, decisión humana que la app nunca toma
   ni automatiza — solo registra, promedia y muestra la nota.

Éxito = cero votos duplicados o de personas que no asistieron ese día, la nota del jurado
calculada sin errores de suma, y ambos flujos completables en el tiempo de un recorrido de
stand (segundos para el aprendiz, pocos minutos para el jurado), incluso con conectividad
inestable.

## Positioning

Una app de una sola noche que ningún formulario genérico (Google Forms, Typeform) puede
igualar porque valida la identidad del votante contra el sistema real de asistencia del SENA
(Pulse) en vez de confiar en la palabra de quien vota, y hace cumplir "un voto por proyecto"
a nivel de base de datos, no de honestidad.

## Operating Context

- El evento ocurre un solo día, con hasta 8 stands (equipos expositores) y hasta ~150
  aprendices visitantes de varias fichas distintas a las expositoras.
- La asistencia real de cada ficha visitante se consulta al sistema Pulse (otro proyecto del
  mismo autor: `~/code/pulse`), vía su endpoint M2M `GET /integrations/attendance` documentado
  en `~/code/pulse/docs/09-m2m-integrations.md`. Devuelve, para una ficha y fecha, el roster de
  aprendices con estado `PRESENT`/`ABSENT`. Solo puede votar un aprendiz que figure `PRESENT`
  ese día.
- Los expositores (aprendices de las fichas que presentan) no votan.
- El jurado califica con la rúbrica oficial SENA (`Rubrica para ADSO.xlsx`, hoja "Rubrica
  SENA"): 18 criterios en 6 bloques (Actitudinal, Dominio del tema, Técnico, Innovación,
  Manejo del tiempo, Calidad del trabajo escrito), escala 1–5, más un criterio nuevo de
  decoración/montaje del stand dentro del bloque Actitudinal (19 en total). El promedio de
  los criterios de un jurado, promediado entre los 3 jurados, da la nota final del proyecto.
- El aprendiz vota con una rúbrica corta de 4 criterios (decoración del stand, claridad de la
  explicación, innovación/utilidad, dominio del equipo), estrellas 1–5.
- No hay pantalla pública de ranking en vivo; los resultados solo los ve el administrador, y
  se revelan al cierre del evento.
- Despliegue on-premise (Docker + Traefik + Cloudflare Tunnel) se resuelve después de terminar
  el codebase; no es parte de este build.

## Capabilities and Constraints

- Un aprendiz vota como máximo una vez por proyecto (regla forzada con índice único en la
  base de datos, no solo validación de aplicación).
- Solo aprendices con asistencia `PRESENT` ese día pueden votar; la validación se hace contra
  una caché local del roster de Pulse (sincronizada por el admin antes del evento) para que la
  votación no dependa de que Pulse esté disponible en el momento exacto del voto.
- El formulario de estrellas debe funcionar sin JavaScript (radios nativos estilizados);
  JS solo añade autoguardado y promedio en vivo.
- Todo el contenido visible está en español, incluidos los mensajes de error.
- La app no calcula ni registra un veredicto de aprobación de etapa lectiva: solo guarda,
  promedia y muestra la nota. Esa decisión la toman los jurados fuera de la app.

## Brand Commitments

Ninguno confirmado. El nombre de trabajo es "ShowRoom Vote"; sin logo, paleta ni tipografía
heredados — mundo visual por definir en la fase de diseño (new-work).

## Evidence on Hand

- `Rubrica para ADSO.xlsx` en la raíz del proyecto: rúbrica oficial de jurados (hoja
  "Rubrica SENA") y una propuesta alterna por indicadores ponderados (hoja "Propuesta ADSO",
  no usada en este build).
- `~/code/pulse/docs/09-m2m-integrations.md`: contrato del endpoint de asistencia M2M.
- No hay fotos reales de stands, logos del centro, ni datos de proyectos reales todavía; los
  datos de proyectos/equipos se cargan por el admin antes del evento. Cualquier imagen o dato
  de ejemplo usado durante el desarrollo debe marcarse como sintético/demo.

## Product Principles

1. La integridad del voto (una persona, un voto, solo si asistió) es no negociable y se
   aplica en la base de datos, nunca solo en la interfaz.
2. El evento no se puede caer porque Pulse esté lento o caído: la validación de asistencia
   vive en una caché local sincronizada de antemano.
3. El aprendiz vota de pie y rápido; el jurado califica sentado y a fondo — son la misma app
   pero con presupuestos de fricción radicalmente distintos.
4. La app registra hechos (notas, promedios); las decisiones humanas (quién gana, quién
   aprueba) las toman personas, nunca un umbral automático oculto.

## Accessibility & Inclusion

Sin requisito específico confirmado más allá de: formularios operables sin JavaScript,
tamaños de toque cómodos para uso de pie con una mano, y contraste legible en exteriores o
salones con luz variable (estándar WCAG AA como piso razonable, sin auditoría formal pedida).
