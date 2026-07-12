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

## 3. Registrar acciones

1. Entra en **Acciones**.
2. Indica el símbolo bursátil, por ejemplo `AAPL`, `MSFT` o `TSLA`.
3. Introduce nombre, cantidad, precio de compra y fecha.
4. Completa opcionalmente sector, stop loss, objetivo, broker y notas.
5. Pulsa **Agregar**.

La carga inicial crea también una operación de compra en **Historial**.

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

Las cotizaciones se consultan mediante CoinGecko. Si un símbolo no está incluido en el mapa interno de la aplicación, deberá valorarse manualmente.

## 5. Otros activos

La sección **Otros** contiene formularios específicos:

- **ETFs**: símbolo, tipo, índice, cantidad, precio, TER, broker y fecha.
- **CEDEARs**: símbolo, ratio, cantidad, precio en ARS y tipo de cambio CCL.
- **Tokenizados**: símbolo, tipo de respaldo, exchange, cantidad y precio.
- **Bonos**: nominal, precio porcentual, tasa, vencimiento, moneda y broker.

Utiliza la categoría que represente realmente el instrumento. No registres una empresa privada como ETF, bono o tokenizado salvo que poseas efectivamente ese producto.

## 6. Actualizar precios

Pulsa **Actualizar precios** en la cabecera.

- Las criptomonedas se consultan mediante CoinGecko.
- Las acciones se consultan mediante Yahoo Finance y servicios de respaldo para resolver restricciones CORS.
- La aplicación informa cuántos precios se actualizaron y cuántos quedaron sin datos.
- Se crea o actualiza el snapshot diario de evolución.
- La actualización automática se ejecuta cada tres minutos mientras la pestaña está visible.

Las APIs externas pueden fallar, limitar solicitudes o devolver datos temporalmente incompletos. Verifica siempre precios importantes con tu broker o exchange. MRP Portfolio no ejecuta operaciones.

## 7. Editar y eliminar

- Usa el botón de lápiz para editar una posición.
- Usa el botón de papelera o `X` para eliminar.
- Las eliminaciones relevantes solicitan confirmación.
- Eliminar una posición no elimina automáticamente sus movimientos históricos; esto preserva la trazabilidad.
- Si también quieres eliminar el historial, hazlo desde **Historial**.

## 8. Historial e importaciones

Cada operación puede registrarse manualmente como compra o venta, indicando símbolo, cantidad, precio, comisión, fecha y broker.

La aplicación admite:

- Archivos Binance XLSX compatibles.
- CSV genérico con vista previa y detección de duplicados.

Para un CSV genérico utiliza encabezados reconocibles como:

```csv
date,type,symbol,qty,price,comm,notes
2026-01-15,COMPRA,AAPL,2,180,1.50,Compra inicial
```

Usa `symbol` o `ticker`; el encabezado abreviado `sym` no está reconocido por el importador genérico.

Revisa siempre la vista previa antes de confirmar una importación.

## 9. Ingresos, DCA, riesgo y evolución

- **Ingresos**: registra dividendos, cupones, staking e intereses.
- **Promedio DCA**: calcula el precio medio ponderado usando el historial.
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

Para restaurar, usa **Importar backup**, revisa que sea el archivo correcto y confirma el reemplazo. La aplicación valida y neutraliza contenido HTML peligroso antes de renderizar datos importados.

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

No es necesario contratar Pro para un uso personal ocasional, pero habrá que reactivar el proyecto cuando Supabase lo pause.

## 15. Privacidad y seguridad

- El repositorio y el HTML son públicos.
- La clave `anon` de Supabase es una clave pública de navegador; no debe confundirse con una clave `service_role`.
- La tabla `portfolio_data` tiene Row Level Security activado.
- El rol anónimo no posee permisos sobre la tabla.
- Cada usuario autenticado solo puede leer o modificar la fila cuyo `user_id` coincide con `auth.uid()`.
- El propietario administrativo del proyecto Supabase puede acceder a la base de datos desde el panel; RLS protege frente a visitantes y otros usuarios de la aplicación, no frente al administrador del proyecto.
- Los textos locales, importados y sincronizados se tratan como datos no confiables y se neutralizan antes de mostrarse.

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

## 18. Resolución de problemas

### La cartera aparece vacía

- Comprueba si estás usando el mismo navegador o la misma cuenta de GitHub.
- Abre el panel de nube y revisa el estado.
- No pulses sincronizar ni elijas una copia durante un conflicto hasta saber cuál contiene los datos correctos.
- Busca el último backup JSON.

### Algunos precios no se actualizan

- Reintenta más tarde.
- Comprueba que el ticker sea correcto.
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
- Chart.js para gráficos.
- CoinGecko y Yahoo Finance para precios.
- TradingView para gráficos técnicos.

## 20. Alcance

MRP Portfolio es una herramienta personal de registro y análisis. No es un broker, no ejecuta órdenes, no garantiza la disponibilidad de cotizaciones y no ofrece asesoramiento financiero, fiscal o legal.
