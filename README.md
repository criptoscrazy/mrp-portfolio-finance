# MRP Portfolio

Aplicación web personal para registrar, valorar y revisar una cartera de inversiones. Funciona directamente en el navegador y admite acciones, criptomonedas, ETFs, CEDEARs, activos tokenizados, bonos, ingresos pasivos y operaciones de trading.

**Aplicación:** [https://criptoscrazy.github.io/mrp-portfolio-finance/](https://criptoscrazy.github.io/mrp-portfolio-finance/)

## 1. Cómo funciona

MRP Portfolio utiliza dos capas de almacenamiento:

- **Navegador (`localStorage`)**: guarda una copia local para que la aplicación funcione incluso sin iniciar sesión.
- **Supabase**: al conectar la cuenta de GitHub, guarda una copia en la nube para recuperar la cartera desde otros navegadores o dispositivos.

GitHub Pages publica la aplicación, pero no almacena las inversiones. Supabase almacena la cartera sincronizada.

## 2. Primer uso

1. Abre la [aplicación](https://criptoscrazy.github.io/mrp-portfolio-finance/).
2. Pulsa el botón de nube de la cabecera.
3. Selecciona **Conectar con GitHub** si todavía no hay una sesión activa.
4. Autoriza el acceso y espera a regresar automáticamente a MRP Portfolio.
5. Comprueba que el botón indique **Sincronizado**.
6. Empieza a registrar activos.

La sesión puede conservarse en el navegador. Si ya existe una sesión válida, la sincronización se iniciará automáticamente y no aparecerá de nuevo el botón de conexión.

En el Dashboard, la tarjeta **G/P por clase de activo** separa el resultado no realizado de Acciones, Cripto, CEDEARs y Otros. El G/P y el ROI de cada clase utilizan las mismas posiciones valoradas que el total general; cuando falta un precio o coste válido, la fila queda marcada como parcial.

## 3. Registrar acciones

1. Entra en **Acciones**.
2. Indica el símbolo bursátil, por ejemplo `AAPL`, `MSFT` o `TSLA`.
3. Introduce nombre, cantidad, precio de compra y fecha.
4. Completa opcionalmente sector, stop loss, objetivo, broker y notas.
5. Pulsa **Agregar**.

La carga inicial crea la posición y también una compra automática en **Historial**. Para compras posteriores o ventas, utiliza **Comprar** o **Vender** en la fila de esa posición. No vuelvas a crear el activo.

Si el mismo símbolo está en dos brokers, se muestran como posiciones distintas. Por ejemplo, `AAPL · Broker A` y `AAPL · Broker B` no se mezclan.

### Empresas no cotizadas

SpaceX no cotiza actualmente en un mercado público y no tiene un ticker oficial verificable mediante Yahoo Finance. Puede registrarse manualmente como posición privada, pero la aplicación no podrá actualizar automáticamente su precio. En ese caso conservará el precio de compra y mostrará que no hay datos de mercado.

No debe utilizarse un símbolo inventado como si fuera una cotización oficial.

## 4. Registrar criptomonedas

1. Entra en **Cripto**.
2. Escribe el símbolo, por ejemplo `ETH`, `SOL`, `ADA` o `DOT`.
3. Añade nombre, cantidad, precio de compra y fecha.
4. Selecciona el tipo de custodia.
5. Añade opcionalmente wallet, dirección y notas.
6. Pulsa **Agregar**.

Cada combinación de activo y custodio es una posición independiente. `BTC · Binance` y `BTC · Exodus` conservan cantidades y precios promedio diferentes. Las operaciones posteriores se realizan desde los botones de su fila.

Las cotizaciones se consultan primero mediante el par Spot `USDT` de Binance. Si el par no está disponible o el proveedor falla, la aplicación prueba CoinGecko y después CryptoCompare. La tabla muestra la fuente y la hora utilizada junto al precio.

## 5. Otros activos

La sección **Otros** contiene formularios específicos:

- **ETFs**: símbolo, mercado de cotización, ISIN cuando se conoce, cantidad, precio de ejecución, comisión opcional, TER informado por el usuario, broker y fecha.
- **CEDEARs**: cada compra se registra como un lote independiente. Elegí `ARS`, `USD MEP` o `USD cable`, indicá cantidad, ratio, precio unitario, importe bruto, costo total, fecha, broker y, si corresponde, ticket, fuente, gastos/comisiones y referencias históricas de CCL, MEP o equivalente en ARS. La tabla consolida por símbolo y broker; nunca mezcla custodios ni monedas.
- **Tokenizados**: símbolo, tipo de respaldo, exchange, cantidad y precio.
- **Bonos**: nominal, precio porcentual, tasa, vencimiento, moneda y broker.

Utiliza la categoría que represente realmente el instrumento. No registres una empresa privada como ETF, bono o tokenizado salvo que poseas efectivamente ese producto.

### ETFs: identificación, precio y costes

Cada ETF se identifica internamente por **ticker + mercado de cotización** y, cuando está disponible, también por su **ISIN**. Así se evita mezclar dos listados del mismo fondo en mercados o monedas diferentes. El broker/custodio sigue formando parte de la posición: el mismo ETF en dos brokers son dos posiciones.

1. En **Otros > ETFs**, escribe el ticker y pulsa **Buscar ETF** para completar nombre, mercado, moneda y símbolo de cotización cuando Yahoo Finance disponga de esos datos.
2. Revisa el mercado antes de guardar. Para Londres, selecciona **LSE**: la aplicación resolverá el símbolo de Yahoo como `TICKER.L`.
3. Añade el ISIN si lo conoces. Es una verificación adicional, no sustituye al mercado de cotización.
4. Escribe la comisión sólo si la conoces; si se deja vacía, el historial muestra `N/D` para la comisión y el total de operación, en vez de presentar un cero que no fue confirmado.
5. El TER no se completa automáticamente: es un dato del producto que debes verificar en la ficha oficial antes de introducirlo o modificarlo.

Para una posición ETF antigua sin mercado o ISIN, abre el lápiz de esa fila y completa mercado, ISIN, símbolo Yahoo y moneda de listado antes de esperar una cotización automática. También puedes registrar allí la comisión de la compra inicial mientras la posición no tenga otras compras o ventas; se actualizan el mismo evento histórico y el coste medio sin duplicar la posición. La aplicación no adivina el mercado a partir del ticker, porque el mismo ticker puede corresponder a listados distintos.

## 6. Actualizar precios

Pulsa **Actualizar precios** en la cabecera.

- Las criptomonedas se consultan mediante Binance Spot (`USDT`), con CoinGecko y CryptoCompare como respaldos.
- Las acciones, ETFs, CEDEARs y acciones tokenizadas se consultan mediante Yahoo Finance y servicios de respaldo para resolver restricciones CORS. En ETFs, el símbolo consultado se deriva del ticker y mercado registrado o de un símbolo de precio validado. Los CEDEARs usan el sufijo `.BA` para obtener su cotización local en ARS.
- La fuente y la hora de cada cotización se conservan con el activo y pueden consultarse en **Más información**.
- La aplicación informa cuántos precios se actualizaron y cuántos quedaron sin datos.
- Se crea o actualiza el snapshot diario de evolución.
- La actualización automática se ejecuta cada tres minutos mientras la pestaña está visible. Solo renueva la caché local de cotizaciones: no crea snapshots, no marca una edición del usuario y no fuerza una subida a la nube.

Las APIs externas pueden fallar, limitar solicitudes o devolver datos temporalmente incompletos. Verifica siempre precios importantes con tu broker o exchange. MRP Portfolio no ejecuta operaciones.

### CEDEARs: precios, resultado y timeline

Los precios actuales de CEDEAR se consultan con el ticker de BYMA en ARS (por ejemplo, `AAPL.BA`). Para compras realizadas en **USD MEP**, el importe realmente pagado en USD es el coste histórico principal: no se reconvierte a ARS ni requiere CCL histórico. El valor actual se calcula como `valor ARS / CCL actual`.

- Al actualizar precios, la aplicación consulta primero el CCL venta de DolarApi.com y conserva valor, fuente y fecha/hora. Si no está disponible, intenta Dolarazo. El botón **Actualizar CCL** permite reintentar; también podés introducir una referencia manual como respaldo.
- Para una posición compuesta íntegramente por compras en USD MEP, la tabla destaca **coste histórico USD**, **valor actual USD**, **G/P USD** y **rentabilidad %**. No se exige CCL histórico para este cálculo.
- El resultado nominal ARS queda como información secundaria y solo se muestra si cada lote tiene una base histórica ARS válida. Si una moneda, precio o CCL actual falta, se muestra `Pendiente`, nunca cero.
- La timeline conserva las compras, ventas y snapshots con sus fechas reales. Las cotizaciones o referencias de CCL que no se hayan guardado para una fecha histórica se muestran como `Pendiente`, nunca como cero.
- Una venta reduce las cantidades disponibles de los lotes sin reescribir su cantidad, coste, moneda, ratio, ticket ni fecha originales.
- **Comprar** prepara una nueva carga para la misma posición; **Vender** impide superar la cantidad disponible.

### Migración de CEDEARs anteriores

Al abrir la versión con lotes, los CEDEARs antiguos se migran de forma compatible: conservan el registro original y se clasifican como compras en `ARS`, usando sus valores existentes de cantidad, ratio, precio y CCL. Antes de la primera migración se conserva en el navegador una copia previa. Desde **Config** podés exportarla como “backup previo a lotes CEDEAR”.

La reversión se hace de forma segura importando ese backup en una versión anterior de la aplicación (9.3 o anterior). No importes el backup previo sobre la misma versión con lotes, porque se migrará de nuevo al abrirse. Exportá siempre un backup completo antes de una actualización importante.

### Migración V2 → V3 centrada en posiciones

V3 toma las posiciones actuales como fuente de verdad. No reconstruye cantidades ni costes desde el Historial antiguo.

1. Exporta un backup completo desde la versión publicada.
2. Ejecuta `node tests/migration-v3-dry-run.cjs /ruta/al/backup.json`.
3. Continúa únicamente si `ok` es `true` y las tres comprobaciones `preserved` son `true`.
4. Ejecuta una vez `supabase/position-v3.sql` en Supabase SQL Editor.
5. Conserva la tabla V2 y el backup original hasta comprobar V3 desde dos navegadores.

La migración añade `positionId`, coste abierto y promedio ponderado sin modificar posiciones, cantidades, costes, custodios, lotes, Timeline ni snapshots. El Historial V2 se conserva como legado informativo y no se utiliza para recalcular posiciones. El proceso es idempotente: volver a ejecutarlo sobre V3 no duplica registros.

V3 utiliza `mrp_portfolio_v3` en el navegador y `portfolio_data_v3` en Supabase. Una versión antigua continúa limitada al almacenamiento V2 y no puede sobrescribir V3. La tabla nueva exige además `schemaVersion = position-v3` y aplica RLS por `user_id`.

## 7. Comprar, vender y editar

- Usa el botón de ojo para consultar todos los datos de una posición sin entrar en edición.
- Usa **Comprar** para aumentar la cantidad. La aplicación recalcula el coste abierto y el promedio ponderado y añade la operación al Historial.
- Usa **Vender** para una venta parcial o total. No permite vender más unidades de las disponibles.
- Una venta total cierra la posición y deja de mostrarla entre las posiciones activas, pero conserva su Historial.
- Usa el lápiz solamente para nombre, notas y datos descriptivos. Cantidad, precio inicial, fecha y custodio no se editan silenciosamente.

`P. COMPRA` conserva siempre el precio de la primera compra de esa posición. `P. PROM. DCA` muestra el precio medio ponderado de las unidades que siguen abiertas e incluye las comisiones de compra. Cada fila del Historial conserva el precio individual de su compra o venta. Una comisión informada se integra en el coste abierto de una compra y se resta del neto de una venta; una comisión no informada queda como `N/D`, sin reinterpretar registros históricos como coste cero.

## 8. Historial e importaciones

**Historial es un registro cronológico automático y de solo lectura.** No es una segunda pantalla para modificar la cartera. Las compras y ventas se introducen una sola vez desde la posición correspondiente.

La aplicación admite:

- Archivos Binance XLSX compatibles.
- CSV genérico con vista previa y detección de duplicados.

Para un CSV genérico utiliza encabezados reconocibles como:

```csv
date,type,symbol,qty,price,comm,notes
2026-01-15,COMPRA,AAPL,2,180,1.50,Compra inicial
```

Usa `symbol` o `ticker`; el encabezado abreviado `sym` no está reconocido por el importador genérico.

Revisa siempre la vista previa antes de confirmar una importación. En V3 solo se importa una operación cuando existe una única posición compatible. Si el mismo símbolo aparece en varios custodios o todavía no existe una posición, la fila se omite para evitar asignaciones o duplicados incorrectos.

## 9. Ingresos, DCA, riesgo y evolución

- **Ingresos**: registra dividendos, cupones, staking e intereses.
- **Promedio DCA**: muestra el precio medio ponderado guardado en cada posición; no reconstruye ni mezcla posiciones usando solo el símbolo del Historial.
- **Riesgo**: muestra exposición por activo y sector, Sharpe y Beta.
- **Evolución**: utiliza snapshots creados al actualizar precios.
- **Alertas**: evalúa condiciones cuando se actualizan las cotizaciones.

Las métricas son informativas y dependen de la calidad y completitud de los datos introducidos. No constituyen asesoramiento financiero.

## 10. Trading Desk

Trading Desk mantiene herramientas separadas del seguimiento de inversión:

- Posiciones LONG y SHORT.
- Diario de trading.
- Checklist de entrada.
- Calculadora de tamaño de posición.
- Límites diarios y mensuales.
- Watchlist.
- Registro psicológico.
- Métricas de performance.
- Reglas y manifiesto personal.

## 11. Sincronización entre navegadores

Los cambios se guardan primero en el navegador y, si existe una sesión activa, se envían automáticamente a Supabase después de una breve espera.

Las diferencias que solo afectan a cotizaciones derivadas —precio actual, variación, fuente u hora— no se consideran un conflicto entre dispositivos. La ventana de elección se reserva para diferencias reales en posiciones, operaciones, notas u otros datos introducidos por el usuario.

Las subidas se procesan en orden. Si realizas otro cambio mientras una subida continúa, la versión nueva queda pendiente y se envía a continuación. Si se pierde la conexión, los datos locales y su marca de cambio se conservan; al recuperar la red, la aplicación vuelve a intentar la subida pendiente.

Para abrir la cartera en otro navegador:

1. Abre la misma URL de MRP Portfolio.
2. Conecta la misma cuenta de GitHub.
3. Espera a que finalice la comprobación de sincronización.
4. Si aparece un conflicto, compara cuidadosamente las opciones local y nube.
5. Elige la copia más reciente o la que contenga la cartera correcta.

No edites simultáneamente la cartera en dos dispositivos sin dejar que el primero termine de sincronizar.

## 12. Copias de seguridad

Supabase no sustituye una copia independiente.

Después de cada revisión mensual:

1. Abre **Config**.
2. Pulsa **Exportar backup**.
3. Guarda el JSON en una ubicación privada, por ejemplo iCloud Drive.
4. No subas backups de cartera al repositorio público de GitHub.

Para restaurar, usa **Importar backup**, revisa que sea el archivo correcto y confirma el reemplazo. La aplicación acepta archivos de hasta 5 MB, valida la estructura completa antes de sustituir la cartera y neutraliza contenido HTML peligroso antes de renderizar datos importados. Un archivo incompleto o con tipos incompatibles se rechaza sin modificar la cartera actual.

## 13. Borrar todos los datos

La opción **Borrar todo** solicita confirmación.

- Si estás conectado, elimina primero tu fila de cartera en Supabase.
- Solo después elimina la copia local.
- Si falla el borrado en la nube, conserva los datos locales y muestra un error.
- Tras completarse, la aplicación se recarga vacía.

Esta acción no debe utilizarse como operación rutinaria.

## 14. Proyecto Supabase pausado

Supabase puede pausar proyectos del plan gratuito con poca actividad. Si el botón de nube muestra un error y el proyecto lleva tiempo sin utilizarse:

1. Entra en [Supabase Dashboard](https://supabase.com/dashboard).
2. Abre `mrp-Portfolio Finance`.
3. Pulsa **Resume project**.
4. Espera hasta que el estado sea **Healthy**.
5. Vuelve a abrir MRP Portfolio.

### Mantenimiento automático con GitHub Actions

El repositorio incluye un workflow que genera actividad mínima en Supabase tres veces por semana:

- Lunes a las `06:17 UTC`.
- Miércoles a las `18:43 UTC`.
- Sábado a las `11:29 UTC`.

Los horarios son fijos pero deliberadamente irregulares. GitHub puede retrasar ocasionalmente una ejecución programada.

Antes de activarlo:

1. Abre **SQL Editor** en el proyecto `mrp-Portfolio Finance`.
2. Copia y ejecuta el contenido de `supabase/keepalive.sql`.
3. En GitHub abre **Settings > Secrets and variables > Actions**.
4. Crea el secreto `SUPABASE_URL` con la URL del proyecto, sin una barra final.
5. Crea el secreto `SUPABASE_ANON_KEY` con la clave pública `anon` o `publishable`.
6. Abre **Actions > Supabase keepalive**.
7. Pulsa **Run workflow** para realizar la primera prueba.
8. Comprueba que la ejecución termina en verde y muestra `Supabase keepalive completed successfully`.

La función `keepalive` no lee ni modifica `portfolio_data`. Solo devuelve una confirmación y la hora del servidor. No utilices una clave `service_role` en este workflow.

### Evitar que GitHub desactive el workflow

GitHub puede desactivar workflows programados de repositorios públicos cuando el repositorio no registra actividad durante 60 días. Las propias ejecuciones programadas no deben considerarse un sustituto de actividad del repositorio.

Cada seis u ocho semanas:

1. Revisa **Actions > Supabase keepalive** y confirma que las ejecuciones siguen en verde.
2. Aprovecha para realizar una actualización real si procede: corregir el README, revisar una dependencia o documentar una prueba.
3. Haz el cambio mediante un commit en la rama `main`.
4. Si GitHub ya lo desactivó, abre el workflow en **Actions** y pulsa **Enable workflow**.

No se recomienda crear commits automáticos sin contenido útil únicamente para simular actividad. Si no hay nada que actualizar, basta con revisar si el workflow continúa habilitado y volver a habilitarlo manualmente cuando GitHub lo solicite.

Supabase no garantiza una cifra exacta de solicitudes que impida toda pausa. Si el proyecto vuelve a pausarse con este calendario, aumenta la frecuencia a una ejecución diaria.

## 15. Privacidad y seguridad

- El repositorio y el HTML son públicos.
- La clave `anon` de Supabase es una clave pública de navegador; no debe confundirse con una clave `service_role`.
- La tabla `portfolio_data_v3` tiene Row Level Security activado y rechaza datos que no declaren el esquema V3.
- El rol anónimo no posee permisos sobre la tabla.
- Cada usuario autenticado solo puede leer o modificar la fila cuyo `user_id` coincide con `auth.uid()`.
- El propietario administrativo del proyecto Supabase puede acceder a la base de datos desde el panel; RLS protege frente a visitantes y otros usuarios de la aplicación, no frente al administrador del proyecto.
- Los textos locales, importados y sincronizados se tratan como datos no confiables y se neutralizan antes de mostrarse.
- Las noticias externas se insertan como texto y solo se habilitan imágenes y enlaces `https`.

Nunca publiques contraseñas, secretos OAuth, claves `service_role` ni backups financieros en GitHub.

## 16. Instalación como acceso directo

### iPhone y iPad con Safari

1. Abre la aplicación.
2. Pulsa **Compartir**.
3. Selecciona **Agregar a pantalla de inicio**.

### Chrome o Edge en ordenador

1. Abre la aplicación.
2. Utiliza **Instalar aplicación** o **Crear acceso directo** desde el menú del navegador.

### Safari en Mac

1. Abre la aplicación en Safari.
2. En el menú **Archivo**, selecciona **Añadir al Dock**.
3. Usa `MRP Portfolio` como nombre y confirma.

La aplicación del Dock sigue siendo una aplicación web administrada por Safari. No crea otra base de datos ni una copia independiente de la cartera: utiliza el mismo almacenamiento web, la misma cuenta de GitHub y la misma sincronización con Supabase.

## 17. Uso sin conexión y copia local

MRP Portfolio no es todavía una PWA offline completa.

Si la aplicación ya estaba abierta cuando se pierde la conexión:

- Puedes consultar la información que ya estaba cargada.
- Puedes registrar o editar datos y se guardarán en `localStorage`.
- La sincronización con Supabase quedará pendiente hasta recuperar internet.
- No funcionarán las cotizaciones, noticias, TradingView ni otros servicios externos.

Al recuperar la conexión, deja la aplicación abierta hasta que el indicador vuelva a mostrar **Sincronizado**. Si también hubo cambios desde otro dispositivo, revisa cuidadosamente cualquier aviso de conflicto antes de elegir una versión.

Si cierras completamente la aplicación e intentas abrirla sin conexión, no se garantiza que cargue. Safari puede necesitar descargar de nuevo el HTML o alguna dependencia externa.

La copia local de `index.html` es un respaldo del código, no la forma recomendada de utilizar la cartera. Abrirla directamente desde Finder utiliza un origen `file://` y puede provocar restricciones de autenticación, CORS, precios y sincronización. Para el uso cotidiano, abre la aplicación del Dock o la URL de GitHub Pages.

Para disponer de funcionamiento offline completo sería necesario incorporar un `service worker`, un manifiesto PWA, caché controlada de dependencias y una cola explícita de sincronización.

Con conexión, la copia local abre automáticamente la URL pública. La versión pública comprueba su número de publicación al iniciarse y al volver a primer plano; si detecta una edición más reciente, la recarga evitando una copia antigua del navegador. Sin conexión, el archivo local sigue abriendo con las limitaciones indicadas.

## 18. Resolución de problemas

### La cartera aparece vacía

- Comprueba si estás usando el mismo navegador o la misma cuenta de GitHub.
- Abre el panel de nube y revisa el estado.
- No pulses sincronizar ni elijas una copia durante un conflicto hasta saber cuál contiene los datos correctos.
- Busca el último backup JSON.

### Algunos precios no se actualizan

- Reintenta más tarde.
- Comprueba que el ticker sea correcto.
- Para ETFs internacionales, revisa el mercado de cotización y, si es necesario, el símbolo de precio guardado. No uses otro mercado sólo porque comparta ticker o ISIN.
- Si necesitas distinguir un ticker incorrecto de un límite temporal del proveedor, abre la consola del navegador: cada petición a Yahoo registra solamente el símbolo, la ruta y el estado HTTP; 429 significa límite temporal de solicitudes.
- Recuerda que empresas privadas como SpaceX no tienen cotización pública.
- Verifica el precio con una fuente financiera independiente.

### Supabase no conecta

- Comprueba que el proyecto esté **Healthy**.
- Verifica que GitHub siga habilitado en Authentication.
- Comprueba que la URL autorizada sea `https://criptoscrazy.github.io/mrp-portfolio-finance/`.

## 19. Arquitectura técnica

- HTML, CSS y JavaScript en `index.html`.
- GitHub Pages para publicación HTTPS.
- Supabase Auth con GitHub OAuth.
- PostgreSQL/Supabase con RLS para sincronización.
- Estado V3 centrado en posiciones y tabla `portfolio_data_v3` separada de V2. Los ETF conservan `ticker + mercado`, ISIN, moneda de listado y símbolo de cotización como metadatos compatibles.
- Chart.js para gráficos.
- Binance Spot, CoinGecko, CryptoCompare, Yahoo Finance, DolarApi.com y Dolarazo para precios y CCL actual.
- TradingView para gráficos técnicos.

### Preparación para futuras conciliaciones de broker

Las operaciones nuevas conservan de forma interna el origen manual y campos reservados para una futura conciliación con un broker. Esto **no** activa una conexión con Interactive Brokers, no guarda credenciales ni importa movimientos automáticamente. Cualquier integración futura deberá ser de solo lectura, comparar diferencias y requerir aceptación explícita antes de cambiar la cartera.

## 20. Alcance

MRP Portfolio es una herramienta personal de registro y análisis. No es un broker, no ejecuta órdenes, no garantiza la disponibilidad de cotizaciones y no ofrece asesoramiento financiero, fiscal o legal.
