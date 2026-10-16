# Cierre de correcciones de MRP Portfolio

Fecha: 16/10/2026, Europe/Madrid. Versión: **2026-10-16.1**.
Base conservada: `69d41e55c228ad8b8c925a6b668a192ca12c440c`.
Rama de corrección: `codex/audit-corrections-2026-10-16`.

## Resultado

Los nueve hallazgos de la auditoría tienen una corrección implementada.
Los cambios H01-H07 están preparados en la aplicación local; H08-H09 se
aplicaron en Supabase y se verificaron mediante sus metadatos. No se
modificaron posiciones, movimientos, snapshots, backups personales ni otros
registros financieros reales.

| Hallazgo | Corrección y evidencia |
|---|---|
| H01 | La vista previa escapa el nombre y los campos del CSV. Un nombre hostil se muestra como texto y no ejecuta código. |
| H02 | Lector oficial SheetJS 0.20.3 distribuido con licencia, aislado en Worker con límites. El libro sintético se procesa sin cargar XLSX en la página principal. |
| H03 | Escrituras atómicas de estado y metadatos, transacción para las mutaciones de usuario y reemplazos de backup/nube. Fallos de cuota y timestamp conservan el estado anterior; el conflicto permanece abierto si no se pudo persistir. También se protege el snapshot de una actualización manual. |
| H04 | Identidad de fuente/fila o ejecución/custodio; compra y venta del mismo día se conservan, las ejecuciones idénticas de filas distintas también, y reimportar no repite operaciones. Las coincidencias inciertas se señalan para revisión. |
| H05 | Propietario explícito, archivos locales por cuenta y espacio local independiente. La asociación inicial exige una decisión. Salir y cambiar A/B no sube A a B. Las pestañas antiguas quedan bloqueadas hasta recargar y las respuestas tardías de otra sesión no se aceptan. |
| H06 | Cerrar Trading abre el formulario de resultado realizado neto, sin modificar la operación hasta guardar un resultado explícito. Se conserva el cero confirmado. |
| H07 | Se validan calendario, dominios, identificadores, vínculos de lotes/historial y coherencia del coste medio cuando esos campos existen. Entradas inválidas no reemplazan la cartera; las migraciones de muestra válidas siguen pasando. |
| H08 | Se revocaron los privilegios sobrantes, incluido MAINTAIN de PostgreSQL 17. authenticated conserva solo SELECT/INSERT/UPDATE/DELETE en ambas tablas, sujetos a RLS; anon no tiene acceso. Las nuevas tablas creadas por postgres requieren permisos explícitos. |
| H09 | La restricción exige un objeto JSON y schemaVersion = position-v3 mediante IS TRUE. Está validada en el servidor; no se descargaron ni reescribieron cargas financieras. |

## Validación

- `npm test`: **18 programas de prueba aprobados**. Incluye regresiones previas,
  importación hostil, disco lleno, cambio de propietario entre cuentas y
  pestañas, calendario, migración y pruebas de base de datos.
- Las pruebas nuevas aportan 29 comprobaciones de integridad y 19 de navegador,
  además de las de base de datos; hay solapamiento con las regresiones previas.
- La prueba de base de datos usa PostgreSQL 18.6 en memoria a través de PGlite,
  con dos identidades ficticias, esquema Auth de prueba y filas sintéticas.
  Comprueba permisos, RLS y rechazo de cargas inválidas, sin acceder a producción.
- La base real usa PostgreSQL 17.6: después de aplicar la migración se verificaron
  los privilegios efectivos, las políticas por propietario y la restricción validada.
- Los gráficos se comprobaron con Chart.js real y datos sintéticos. La prueba de
  integridad de recursos permite los bytes correctos y bloquea un script alterado.
- La prueba separada de precios CEDEAR pasó con cotizaciones públicas y posiciones
  ficticias; no equivale a reconciliar precios, CCL o cantidades de tu cuenta real.
- Se corrigieron las expectativas antiguas de tamaño de la versión y release.
  La versión visible aumenta de 10 a 11 px y conserva una presentación discreta.
- Se añadió integración continua con dependencias fijadas, lockfile y acciones
  oficiales fijadas por revisión. Su ejecución remota queda pendiente de subir
  la rama; no se afirma haberla ejecutado en GitHub.

## Cambios complementarios y límites

La aplicación incluye SRI para las dependencias estáticas compatibles, CSP de
orígenes y calendario NYSE de 2027. La política conserva `unsafe-inline` para
los eventos heredados; no se presenta como una CSP estricta que neutralice
cualquier inyección inline.

La advertencia adicional de Supabase sobre contraseñas filtradas sigue activa.
La configuración pública permite GitHub y correo electrónico, aunque la app
ofrece GitHub. Se confirmó que la organización usa el plan gratuito; Supabase
reserva esa protección para Pro o superior. No se cambió el plan, se contrataron
servicios ni se deshabilitaron métodos de acceso existentes. Es una observación
adicional, distinta de H01-H09, que necesita una decisión del propietario.

No se autenticaron cuentas reales para las pruebas ni se enviaron órdenes de
broker. La auditoría/corrección técnica no certifica la exactitud contable o
fiscal de tus tenencias. No se ha publicado el frontend corregido: la página
pública conserva su versión hasta autorizar la publicación.

## Recuperación y revisión

Se conservó un archivo del commit original con manifiesto SHA-256, fuera del
repositorio. La rama aislada y el paquete versionado permiten revisar el cambio
antes de publicarlo. Las evidencias incluyen logs, comprobación de metadatos de
Supabase, recurso alterado bloqueado y hashes de los archivos entregados.

La migración versionada es `supabase/audit-hardening.sql`. Su validación aborta
la transacción si encuentra una carga previa incompatible; no la modifica
silenciosamente. La aplicación anterior V3 sigue cumpliendo la restricción y
sus operaciones necesarias conservan permisos.

Fuentes: [SheetJS oficial](https://docs.sheetjs.com/docs/getting-started/installation/standalone/),
[contraseñas de Supabase](https://supabase.com/docs/guides/auth/password-security),
[calendario NYSE](https://www.nyse.com/trade/hours-calendars),
[PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
