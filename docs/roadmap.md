# Roadmap de funcionalidades nuevas

Funcionalidades que ofrece la propuesta para el Club Los 50 (Tandil, rugby y hockey) y que el repo todavía no tiene. **Nada de esto está implementado.** Cada ítem está pensado para trabajarse en una sesión aparte, con uno o más PRs chicos.

Este documento no reemplaza a `docs/audit/AUDIT.md`: aquel tiene la remediación técnica (§6), las decisiones tomadas (Anexo C) y el estado del proyecto (Anexo D). El proyecto está **en pausa desde el 2026-10-07**, y el orden para retomarlo que fija el Anexo D (staging, después `eas.json` y builds, después los pendientes técnicos) sigue vigente. Este roadmap se suma a ese orden; no lo reemplaza.

**Tamaños** (relativos): **S**, un PR chico; **M**, uno o dos PRs; **L**, varios PRs que tocan backend, panel y otra superficie.

**En cada ítem:** "Definido" es lo que ya está decidido (el pedido o una regla del `CLAUDE.md` o del Anexo C). "Preguntas abiertas" son decisiones de producto que **no están tomadas** y hay que responder antes de implementar.

## Resumen

| # | Ítem | Tamaño | Depende de | Bloqueo externo |
|---|---|---|---|---|
| 1 | Divisiones y planteles | M | — | — |
| 2 | Fixture y resultados | M | 1 | — |
| 3 | Web pública del club | L | 1, 2 y 4 (por sección), T-A, T-B | Dominio y deploy (T-C) |
| 4 | Sponsors | S | T-B (logos) | — |
| 5 | Apto médico | S (M con archivo o historial) | — | — |
| 6 | Pago de cuotas con Mercado Pago | L | T-A, T-C | Cuenta de MP del club, URL HTTPS pública |
| 7 | Recordatorios de deuda | M (L con WhatsApp) | T-C; 6 para el link de pago | Dominio de Resend; proveedor de WhatsApp si se elige |

## Reglas que aplican a todos los ítems

Salen del `CLAUDE.md` y no se repiten en cada sección:
- Tablas nuevas con `club_id`, RLS con `FORCE`, políticas con `WITH CHECK` y migración de Alembic (`alembic check` limpio). Enums como `str_enum`.
- Las relaciones con entidades del mismo club usan FK compuesta `(id, club_id)`, como `fk_club_memberships_plan_same_club`.
- El club sale del contexto (`StaffContext` o `MemberContext`); todo id del cliente se resuelve con `get_scoped`.
- Permisos nuevos en `domain/permissions.py`. Cada endpoint nuevo lleva tests de permisos y de aislación entre clubes.
- Listados con `Page[T]`, rangos de fechas con `app.core.time` y `club.timezone`, dinero en `Decimal`.
- Después de cambiar el backend se regenera `packages/types`.

## Piezas transversales

Varios ítems necesitan lo mismo. Conviene resolverlo una vez, dentro del primer ítem que lo use.

**T-A. Endpoints públicos (sin sesión).** Hoy no hay ninguno de lectura: el directorio de clubes de la app (`GET /mobile/clubs`) exige sesión. La web pública (3) y el webhook de Mercado Pago (6) los necesitan.
- Un router `api/v1/public/` que resuelve el club por `slug` (solo activos, 404 si no) y fija el contexto de RLS con `set_tenant_context`, como hacen hoy los jobs.
- Rate limit por IP (`api/rate_limit.py`).
- Schemas propios que exponen solo campos públicos. Nunca reutilizar los del panel.

**T-B. Imágenes.** Hoy `Club.logo_url` es una URL que se carga a mano (`AnyHttpUrl`) y no hay subida de archivos. La necesitan los logos de sponsors (4), la portada e historia de la web (3) y, si se decide guardarlo, el certificado del apto médico (5). La decisión 11 del Anexo D deja Supabase Storage "como opción para imágenes". Pregunta abierta: URL a mano, como hoy, o subida de archivos (y en ese caso, dónde se guardan).

**T-C. Staging (paso 1 del Anexo D).** Hace falta antes de 6 (el webhook necesita una URL HTTPS pública y una cuenta de MP de prueba) y de 7 (el dominio de Resend verificado). Para publicar la web pública (3), también.

**T-D. Permisos y roles.** La matriz tiene tres roles: `OWNER`, `RESERVATIONS_MANAGER` y `STOCK_MANAGER`. Los ítems 1, 2, 3 y 4 necesitan permisos nuevos (por ejemplo `teams:write`, `fixture:write`, `site:write` y `sponsors:write`). Pregunta abierta, común a todos: qué roles los reciben, y si hace falta un rol nuevo (por ejemplo, coordinador deportivo o prensa). Los entrenadores podrían ser staff con acceso limitado a su equipo, y la matriz actual no tiene permisos por recurso.

---

## 1. Divisiones y planteles · M

**Qué es.** Los equipos del club, cada uno con deporte y categoría (por ejemplo, rugby M15 o hockey Primera), y los jugadores de cada plantel vinculados a su `ClubMembership`.

**Qué toca.**
- **Modelo:** `Team` (`club_id`, `sport`, `category`, nombre, activo) y `TeamPlayer` (`club_id`, `team_id`, `membership_id`, con FK compuestas al mismo club y único por equipo y membresía).
- **Service:** `TeamService(session, ctx)`, con el ABM de equipos, altas y bajas de jugadores y la validación de que la membresía sea del club (`get_scoped`).
- **Endpoints:** `/admin/teams` (listado, alta, edición, baja) y `/admin/teams/{id}/players`.
- **Panel:** `features/teams` con el listado de equipos, el formulario y el plantel, con buscador de socios.
- **App:** a definir (ver preguntas).
- **Web pública:** la sección "Divisiones" (ítem 3).

**Qué reutiliza.** El enum `Sport` (ya tiene `RUGBY` y `HOCKEY`) y `Club.sport_types`, `ClubMembership`, `get_scoped`, `paginate`, el patrón de FK compuesta y el `member-picker` de `features/members`.

**Dependencias.** Ninguna. Es la base de 2 y de la sección de divisiones de 3.

**Definido.**
- Los equipos son por club y tienen deporte y categoría.
- Los jugadores se vinculan a `ClubMembership`, no al `User` global.

**Preguntas abiertas.**
- **Menores sin cuenta.** Hoy una `ClubMembership` exige un `User` con email y contraseña propios. Muchos jugadores de infantiles y juveniles no los tienen. ¿Cómo se registran? ¿Con una cuenta de un adulto responsable que tiene varios socios a cargo? ¿El staff carga socios sin cuenta? Es la pregunta más grande del roadmap: cambia el modelo de identidad y afecta también a 5, 6 y 7.
- ¿Un jugador tiene que ser socio `APPROVED`? ¿Qué pasa con el plantel si su membresía pasa a `INACTIVE`?
- **Categorías:** ¿lista fija por deporte o texto libre de cada club? ¿Hay rama (masculino, femenino, mixto)?
- **Temporadas:** ¿los planteles se rearman cada año (un equipo por temporada) o son permanentes, con altas y bajas?
- ¿Un jugador puede estar en más de un equipo a la vez?
- ¿Se cargan datos del jugador en el plantel (posición, número de camiseta)?
- ¿Se registran entrenadores y managers? ¿Como dato del equipo o como staff con permisos sobre su equipo (ver T-D)?
- ¿El socio ve sus equipos en la app?
- ¿La web pública muestra nombres o fotos de jugadores? Incluye menores.
- Qué permisos y roles (T-D).

## 2. Fixture y resultados · M

**Qué es.** Los partidos de cada equipo, con fecha, rival, condición de local o visitante y resultado. Los carga el staff desde el panel.

**Qué toca.**
- **Modelo:** `Match` (`club_id`, `team_id` con FK compuesta, `starts_at` `timestamptz`, rival, local/visitante, lugar, estado como `str_enum` y tantos a favor y en contra, que pueden ser nulos). Un `CHECK` que exija resultado solo en los partidos jugados.
- **Service:** `MatchService`, con el ABM, la carga de resultado y el listado por equipo y por rango de fechas.
- **Endpoints:** `/admin/matches` con filtros por equipo y por rango (semiabierto, en la zona del club) y la carga de resultado.
- **Panel:** `features/fixture`, con la lista o el calendario por equipo, el formulario del partido y la carga de resultado.
- **App:** a definir (ver preguntas).
- **Web pública:** las secciones de fixture y resultados (ítem 3).

**Qué reutiliza.** `Team` (ítem 1), `app.core.time` para "hoy" y los rangos, `AwareDatetime` en la entrada y `Page[T]`.

**Dependencias.** 1.

**Definido.**
- Un partido es de un equipo y tiene fecha, rival, condición de local o visitante y resultado.
- Lo carga el staff desde el panel.

**Preguntas abiertas.**
- **Rival:** ¿texto libre o una tabla de rivales reutilizable (con escudo, que necesitaría T-B)?
- ¿Se registra la competencia o el torneo y la fecha o jornada? ¿Hace falta una tabla de posiciones? Hoy no está pedida.
- **Resultado:** ¿solo los tantos a favor y en contra, o algo más (tries, puntos bonus, definición por penales o shoot-outs en hockey)?
- **Estados:** ¿programado, jugado, postergado, suspendido, cancelado? ¿Se carga un partido con día pero sin hora? Hoy las fechas de entrada son `AwareDatetime` con hora.
- ¿Hay cancha neutral, además de local y visitante?
- ¿Un partido de local reserva automáticamente la cancha del club (y choca con el `EXCLUDE` de reservas)?
- ¿Hace falta cargar en bloque una fecha entera (por ejemplo, todas las infantiles contra el mismo club)?
- ¿Quién carga el resultado (staff, entrenadores)? Ver T-D.
- ¿El socio ve en la app los próximos partidos de sus equipos? ¿Se avisa a los jugadores? Las notificaciones se quitaron (Anexo C, ver ítem 7).

## 3. Web pública del club · L

**Qué es.** Un sitio de solo lectura por `slug` del club, con inicio, historia, divisiones, fixture, novedades, "hacete socio" y sponsors.

**Qué toca.**
- **Modelo:** contenido del sitio que hoy no existe, como la historia o "sobre el club", la imagen de portada y las redes. Pueden ser campos nuevos en `Club` o una tabla `ClubSiteContent`. Si las novedades no son todas públicas, `ClubNews` necesita un indicador (ver preguntas).
- **Service y endpoints:** `api/v1/public/clubs/{slug}` (datos del club e historia) y sus secciones `teams`, `matches`, `news` y `sponsors` (T-A). Del lado del panel, la edición del contenido del sitio, con un permiso nuevo (T-D).
- **Panel:** una sección "Sitio web" (en Ajustes o propia) para editar historia, portada y redes, y para elegir qué novedades se publican.
- **Web pública:** las páginas, renderizadas en el servidor con revalidación (ISR), sin cookies de sesión y con `metadata` para SEO. Los colores del club (`primary_color`, `accent_color`) entran como valores de los tokens semánticos, no como colores sueltos.
- **App:** no la toca, salvo que "hacete socio" mande a la app.

**Qué reutiliza.**
- `Club`: `slug`, `name`, `logo_url`, colores, dirección, teléfono, email, `website` y `sport_types`.
- `ClubNews` y la lógica de vigencia de `services/news.py`.
- El flujo de membresía `PENDING`: `POST /mobile/clubs/{club_id}/membership-requests` (exige email verificado) y la aprobación del staff en `/admin/membership-requests`. También `/auth/register` y la página `verify-email` de la web.
- Los ítems 1, 2 y 4 para sus secciones.

**Dependencias.**
- T-A siempre. T-B si hay imágenes propias (portada, logos de sponsors).
- 1, 2 y 4 para sus secciones. Puede salir por partes: primero inicio, historia, novedades y "hacete socio", y las demás secciones a medida que existan.
- T-C para publicarla.

**Definido.**
- Solo lectura, por `slug` del club.
- Secciones: inicio, historia, divisiones, fixture, novedades, "hacete socio" y sponsors.
- Las novedades reutilizan `ClubNews`, y "hacete socio" reutiliza el flujo de membresía `PENDING`.

**Preguntas abiertas.**
- **Dónde vive:** ¿rutas públicas dentro de `apps/web` (hoy el `proxy.ts` manda a `/login` todo lo que no está en `PUBLIC_PREFIXES`, y la app tiene la CSP y las cookies del panel) o una app Next aparte en el monorepo?
- **Dominio:** ¿una ruta o subdominio de ClubSystem, o el dominio propio del club (con DNS y certificado en Vercel)?
- **Novedades:** ¿todas las de `ClubNews` son públicas? Hoy solo las ven los socios aprobados en la app. ¿Se marca cada novedad como pública, o hay dos tipos?
- **"Hacete socio":** ¿manda a descargar la app (con deep link al club) o permite registrarse y pedir la membresía desde la web? La web hoy es solo del staff, y registrarse en ella sería un flujo nuevo para socios.
- ¿Se muestran los planes y precios (`MembershipPlan.monthly_fee`)?
- **Historia:** ¿texto plano, con formato (Markdown) o con galería de fotos?
- ¿Diseño único con los colores y el logo del club, o personalizable?
- Fotos y nombres de jugadores, menores incluidos (ver 1).
- ¿Hace falta analítica? Si usa cookies, hace falta un banner de consentimiento.
- ¿Formulario de contacto? No está pedido.

## 4. Sponsors · S

**Qué es.** Un ABM simple de sponsors del club, con nombre, logo, link y orden. Se muestran en la web pública.

**Qué toca.**
- **Modelo:** `Sponsor` (`club_id`, `name`, `logo_url`, `link_url`, `sort_order`, activo), con índice por `(club_id, sort_order)`.
- **Service:** `SponsorService`, con el ABM y el reordenamiento (recibe la lista ordenada de ids, todos resueltos contra el club).
- **Endpoints:** `/admin/sponsors` y `GET /public/clubs/{slug}/sponsors` (T-A).
- **Panel:** `features/sponsors`, con el listado, el reordenamiento y el formulario.
- **Web pública:** la sección o franja de sponsors, con links `rel="sponsored noopener"`.
- **App:** a definir.

**Qué reutiliza.** El patrón de ABM de `features/news` o de `membership_plans` y la validación de URLs con `AnyHttpUrl`.

**Dependencias.** T-B si el logo se sube. Si es una URL, no depende de nada. Lo consume 3.

**Definido.** Nombre, logo, link y orden.

**Preguntas abiertas.**
- ¿Logo como URL o con subida (T-B)?
- ¿Vigencia (fecha desde y hasta, por contrato)?
- ¿Niveles (principal, oro, plata) que cambian el tamaño o la posición?
- ¿Un sponsor puede estar asociado a una división (por ejemplo, el de la camiseta de M15)?
- ¿Se muestran también en la app?
- ¿Quién los gestiona (T-D)?

## 5. Apto médico del socio · S

**Qué es.** La fecha de vencimiento del apto médico de cada socio y un aviso en el panel de los vencidos.

**Qué toca.**
- **Modelo:** la fecha de vencimiento, por club. Puede ser un campo en `ClubMembership` o una tabla con historial (ver preguntas).
- **Service:** `MemberService.update` acepta el campo nuevo. Un filtro de vencidos y por vencer calculado con "hoy" en la zona del club (`today_in`). Un contador en el dashboard de operaciones.
- **Endpoints:** el `PATCH /admin/members/{id}` que ya existe, un filtro nuevo en `GET /admin/members` y un campo nuevo en `GET /admin/dashboard/operations` (`null` si el rol no tiene permiso, como `pending_membership_requests`).
- **Panel:** una columna o badge en el listado de socios, el filtro y una alerta en Inicio.
- **App:** a definir (ver preguntas).

**Qué reutiliza.** `MemberService`, `MemberFilters`, `member-edit-dialog`, `DashboardOperationsOut` y `app.core.time`.

**Dependencias.** Ninguna. Se puede hacer en paralelo con cualquier otro ítem.

**Definido.**
- Se guarda la fecha de vencimiento.
- El panel muestra una alerta de vencidos.
- Es un dato de salud, que la Ley 25.326 trata como dato sensible: se guarda solo la fecha (sin diagnóstico), no se loguea ni se manda a Sentry, y lo ve solo quien tenga permiso.

**Preguntas abiertas.**
- ¿Quién lo carga: el staff, el socio desde la app, o los dos?
- ¿Se guarda el certificado (archivo)? Si se guarda, va en almacenamiento privado (T-B) y el ítem pasa a M.
- ¿Se guarda el historial de aptos o solo el vigente?
- ¿Con cuántos días de anticipación se considera "por vencer"?
- ¿Un apto vencido bloquea algo (reservar, figurar en un plantel o en un partido)?
- ¿Se pide a todos los socios o solo a los jugadores (ítem 1)?
- ¿El socio ve su vencimiento en la app? ¿Se le avisa (ver ítem 7)?
- ¿Qué roles lo ven? ¿Hace falta un permiso propio, distinto de `members:read`?
- ¿Va en el CSV de socios?

## 6. Pago de cuotas online con Mercado Pago · L

**Qué es.** El socio paga su cuota con Mercado Pago. MP avisa por webhook y la cuota queda pagada, con su `Payment` de método `MERCADOPAGO` en la caja.

**Antecedente (SEC-04).** El sistema viejo guardaba el token de MP sin cifrar y `GET /settings` lo devolvía en claro a cualquier rol. Con ese token se puede cobrar, reembolsar y ver pagos. En la reescritura se quitó (Anexo C y fila SEC-04 del Anexo D), y el cifrado en reposo (T2.6) nunca llegó a hacerse. Volver a guardarlo exige:
- Cifrado en reposo, con la clave fuera de la base (variable de entorno o gestor de secretos).
- Solo escritura desde el panel: la API nunca lo devuelve, como mucho `has_mercadopago_credentials: bool`.
- Solo con `settings:write` (OWNER).
- Nunca en logs ni en Sentry: hay que sumarlo a los filtros del backend y de `packages/shared`.
- Que se pueda rotar y borrar.

**Qué toca.**
- **Modelo:**
  - Las credenciales de MP del club, cifradas.
  - Un registro de cada intento de pago (`club_id`, cuota, membresía, id de la preferencia, id del pago en MP con índice único, estado y monto). Mapea el aviso de MP con el club y la cuota del lado del servidor, y hace que el webhook sea idempotente.
- **Service:**
  - Crear el checkout: el monto sale de la cuota, nunca del cliente.
  - Procesar el aviso.
  - Separar el núcleo de `FeeService.pay`: hoy exige `StaffContext` (`created_by_id`), y el cobro del webhook lo hace el sistema. El staff y el webhook comparten el mismo UPDATE condicional (no se duplica la lógica).
  - Un job de conciliación en el `scheduler` para los pagos que MP no avisó. Tiene que ser idempotente, porque puede haber varias réplicas.
- **Endpoints:**
  - `GET /mobile/clubs/{club_id}/fees`: hoy el socio no ve sus cuotas en ningún lado.
  - `POST /mobile/clubs/{club_id}/fees/{fee_id}/checkout` (`MemberContext`, cuota resuelta con `get_scoped` y de esa membresía).
  - Un webhook público (T-A) que:
    - verifica la firma `x-signature` con el secreto del webhook;
    - descarta los avisos repetidos;
    - no confía en el payload: consulta el pago en la API de MP con las credenciales del club;
    - valida el estado, el monto y la moneda;
    - cobra la cuota en una transacción con el contexto de RLS del club.
  - La carga de credenciales en el panel.
- **Panel:** credenciales en Ajustes (solo escritura) y, en Cuotas, el método y el estado del pago online.
- **App:** "Mis cuotas" y el botón de pagar.
- **Web pública:** según dónde se decida cobrar (ver preguntas).
- **Tests:** firma inválida, aviso repetido, monto distinto, pago de un club con credenciales de otro, aislación y la carrera con un cobro en efectivo simultáneo.

**Qué reutiliza.**
- `MembershipFee` y `Payment` (el libro único de caja, BE-10).
- `PaymentMethod.MERCADOPAGO`, que ya existe.
- El UPDATE condicional de `FeeService.pay` (BE-04) y la anulación del pago, que devuelve la cuota a pendiente. Sirve para reembolsos y contracargos.
- El `scheduler` de `workers/` y `set_tenant_context`.

**Dependencias.**
- T-A.
- T-C: el webhook necesita una URL HTTPS pública, y hace falta una cuenta de MP de prueba.
- Para el cliente HTTP: el SDK de Python de MP es síncrono (`requests`), y el `CLAUDE.md` no permite nada bloqueante en `async def`. Va con `httpx` async o el SDK en el threadpool.

**Definido.**
- El cobro es con Mercado Pago.
- Un webhook marca la cuota como pagada.
- Las restricciones de SEC-04 de arriba.

**Preguntas abiertas.**
- **Producto de MP:** ¿Checkout Pro (redirige a MP, no cambia la CSP) o Checkout API/Bricks (dentro del sitio, cambia la CSP)?
- **Cuentas:** ¿cada club conecta su propia cuenta? ¿Con credenciales cargadas a mano o con OAuth de MP como marketplace? El marketplace permitiría que ClubSystem cobre una comisión, y eso es una decisión de negocio.
- ¿Quién absorbe la comisión de MP: el club, o un recargo al socio?
- ¿Desde dónde paga el socio: la app, la web pública, un link por email (ítem 7) o varios?
- ¿Se pueden pagar varias cuotas juntas, adelantadas o en forma parcial?
- ¿Débito automático (suscripciones de MP)? ¿Entra en este ítem?
- ¿Qué pasa con un pago aprobado sobre una cuota que ya se cobró en efectivo o que se canceló? ¿Se reembolsa o queda a favor?
- ¿Hace falta comprobante o factura? Hoy no hay facturación.
- Menores: ¿quién paga la cuota del jugador (ver 1)?

## 7. Recordatorios de deuda a socios morosos · M

**Qué es.** Avisos a los socios que tienen cuotas vencidas sin pagar.

**Antecedente (Anexo C).** Las notificaciones y los avisos de WhatsApp se quitaron porque eran configuración sin efecto ("se quitan… hasta implementarlos"). Lo que se agregue tiene que funcionar de punta a punta desde el primer PR: nada de opciones en Ajustes que no hagan nada.

**Qué toca.**
- **Modelo:**
  - Un registro de recordatorios enviados (`club_id`, cuota o membresía, canal, tipo y fecha de envío), único por cuota, tipo y canal. Así no se duplican con varias réplicas, como pide el `scheduler`.
  - La configuración del club (activo, días después del vencimiento, frecuencia), en `Club` o en una tabla propia.
- **Service y job:**
  - La consulta de morosos: cuotas `PENDING` con `due_date` anterior a "hoy" del club. Hoy `FeeFilters` no tiene un filtro de vencidas.
  - Un job en `workers/`, con una transacción y el contexto de RLS por club, como `expire_unconfirmed_reservations`.
  - El envío con `services/email.send_email`, fuera del request.
- **Endpoints:**
  - Listado de morosos en el panel.
  - Envío manual de un recordatorio.
  - Historial de recordatorios enviados.
  - Configuración.
- **Panel:** la configuración en Ajustes, y en Cuotas el filtro de vencidas, el botón "enviar recordatorio" y el historial.
- **App:** nada, salvo que se elijan las notificaciones push. No existen hoy: no hay tokens de dispositivo ni Expo Push.

**Qué reutiliza.** `services/email.py` (Resend), `MembershipFee` y la consulta de `services/fees.py`, el `scheduler`, `app.core.time` y, si existe, el link de pago del ítem 6.

**Dependencias.**
- T-C: el dominio de Resend tiene que estar verificado (pendiente del Anexo D).
- 6 es opcional, para incluir un link de pago.
- WhatsApp necesita un proveedor externo (ver preguntas).

**Definido.**
- Avisos a los socios morosos.
- Las restricciones del Anexo C: nada de configuración sin efecto.
- Nunca se loguean emails ni teléfonos.

**Preguntas abiertas.**
- **Moroso:** ¿desde cuántos días después del vencimiento? ¿Con una cuota vencida o con varias?
- ¿Automáticos, manuales desde el panel, o los dos?
- ¿Con qué frecuencia se repite, y hasta cuántos avisos por cuota?
- **Canales:**
  - Email: ya existe.
  - Push: hay que construirlo (tokens de dispositivo y Expo Push).
  - WhatsApp: necesita WhatsApp Business Platform (verificación de Meta, plantillas aprobadas, costo por mensaje y consentimiento previo del socio). ¿Quién paga ese costo?
- ¿El texto es fijo o lo edita cada club? ¿Incluye el monto?
- ¿Cómo se da de baja un socio de estos avisos?
- Menores: ¿a quién se le manda el aviso (ver 1)?
- ¿Se ve en la ficha del socio que se le mandó un recordatorio?

---

## Orden de implementación propuesto

Antes de cualquier ítem van las preguntas abiertas que bloquean, en especial **los menores sin cuenta (ítem 1)**, que cambia el modelo de identidad y toca a 1, 5, 6 y 7.

1. **Divisiones y planteles (1).** No depende de nada y es la base de 2 y de 3. Además fija la respuesta sobre menores, que necesitan los ítems siguientes.
2. **Fixture y resultados (2).** Solo necesita 1. Con 1 y 2 el panel ya tiene la parte deportiva, que es lo que distingue la propuesta para un club de rugby y hockey.
3. **Sponsors (4).** Es chico y es contenido que la web pública necesita. Si se decide subir logos, acá se resuelve T-B, que reutiliza la web.
4. **Web pública (3).** Va después de 1, 2 y 4 porque los muestra. Acá se construye T-A, que después reutiliza el webhook de 6. Puede arrancar antes con inicio, historia, novedades y "hacete socio" si la propuesta necesita mostrar algo pronto.
5. **Apto médico (5).** Es independiente y chico: entra en cualquier momento, también en paralelo con los anteriores. Queda en este lugar solo porque no habilita a ningún otro ítem.
6. **Mercado Pago (6).** Es el más riesgoso: credenciales de terceros (SEC-04), dinero y un webhook público. Además necesita staging (T-C) y una cuenta de MP, que hoy no existen. Conviene hacerlo con T-A ya probado en la web pública y con el entorno arriba.
7. **Recordatorios (7).** Necesita el dominio de Resend (T-C). Va después de 6 para que el aviso incluya el link de pago: un recordatorio sin forma de pagar online le sirve menos al club. Si el club no quiere pago online, puede ir antes, solo con email.

Los ítems 1 a 5 no necesitan ninguna cuenta externa y se pueden hacer con el proyecto todavía sin desplegar. 6 y 7 recién tienen sentido después del paso 1 del Anexo D (staging).
