# MRP Portfolio | Integridad financiera y seguridad

## A. Resumen ejecutivo

Se prepararon cuatro correcciones locales: certeza de la G/P, prorrateo de la base ARS de CEDEARs, representación segura de textos y avisos visibles de calidad de cotizaciones. Se revisaron reservas y liquidez con datos sintéticos. La intervención conserva el coste medio ponderado, el orden de consumo de lotes por fecha de adquisición y las reglas del total patrimonial.

## B. Estado inicial

- Versión inicial: `2026-11-20.1`.
- Rama inicial: `main`, limpia. `HEAD` y el `main` de GitHub coincidían con `7246e28da5199551ca2952029fcda53f68f4b0ee`. Sin diferencias frente a la referencia auditada.
- Punto de recuperación: `7246e28`, conservado en `main`. Cambios sin commit en la rama local `codex/portfolio-integrity-2026-11-23`.

## C. Defectos confirmados

| Incidencia | Gravedad | Causa | Corrección | Pruebas | Estado |
|---|---|---|---|---|---|
| A. G/P con comisiones incompletas | Alta | La vista de venta validaba la comisión de salida y tomaba la G/P guardada como definitiva aunque faltara acreditar comisiones de adquisición. Una base ausente podía computarse como cero. | Estado común derivado en lectura. Confirmación retrospectiva a partir de los movimientos y el coste abierto o de los lotes consumidos. | Compras sucesivas, cero explícito, comisiones ausentes, ventas parciales, bases faltantes y movimientos posteriores. | Corregida y verificada localmente. |
| B. Base histórica de CEDEARs | Alta | El equivalente ARS explícito de un lote se aplicaba completo al remanente. Las asignaciones de coste calculadas por unidad podían dejar un residuo decimal. | Se prorratea por cantidad pendiente. Cada venta nueva asigna la diferencia entre la base antes y después de consumir el lote. | 10 unidades y 1.000 ARS iniciales; después de vender 5, base 500 ARS y G/P abierta 0 ARS. Ventas sucesivas, gastos, varias monedas y custodios. | Corregida y verificada localmente. |
| C. Textos interpretables como HTML | Alta | Alertas y otras vistas concatenaban textos y argumentos dinámicos en plantillas HTML. El saneamiento general de datos no sustituye la protección en el punto de renderizado. | Texto asignado por DOM en Alertas y asociación de acciones con eventos. Codificación de textos y argumentos en vistas adyacentes. | Texto inerte con etiquetas, atributo de evento vacío, comillas, longitud elevada, notas ausentes y restauración JSON. | Corregida y verificada localmente. |
| D. Apariencia de valoración vigente | Media | El total incluía precios de referencia antiguos con el aviso principalmente en el panel de calidad. Una alerta podía activarse con un precio antiguo. | Avisos junto al patrimonio, datos provisionales visibles y verificación de vigencia para alertas. | Igualdad del total con precio antiguo, G/P provisional y prueba visual de Dashboard, posiciones y Riesgo. | Corregida y verificada localmente. |
| Consumo de saldos comprometidos | Media | Los compromisos son asignaciones informativas y el motor de movimientos valida el saldo contable disponible en cuenta. | Se revisaron conciliación y ausencia de doble cómputo. La política de gasto de comprometidos queda para decisión del propietario. | Saldos y reservas por cuenta y moneda, patrimonio con y sin asignaciones, transferencia propia. | Pendiente de decisión. |

## D. Correcciones preparadas

- `index.html`: distingue resultado confirmado, provisional e información insuficiente. Un cero requiere una declaración numérica coherente con su estado. Las ventas históricas usan el importe almacenado si concilia con la evidencia de coste y de importe neto. La falta de trazabilidad puede rebajar la certeza. Para una venta nueva con base desconocida se omite la G/P.
- `index.html`: mantiene el coste original de cada lote, distribuye la base ARS explícita por cantidad, conserva la moneda de compra y excluye del coste abierto los lotes agotados. Una comisión en otra moneda se conserva en su moneda y bloquea un resultado cuando falta una conversión comparable.
- `index.html`: señala los importes basados en cotizaciones antiguas, CCL antiguo o sin fecha y la equivalencia estimada de moneda de cotización cuando corresponde. Actualiza Dashboard, tablas, Historial, Riesgo y Coste medio.
- `tests/portfolio-financial-integrity.cjs` y `tests/portfolio-integrity-visual.cjs`: programas sintéticos de aceptación. `tests/run.cjs`: registra ambas pruebas. Este documento guarda decisiones, impacto y reversión.

## E. Pruebas realizadas

Pasaron los 21 programas de `npm test`: los 19 programas de la referencia y los dos nuevos. Los nuevos contienen 36 comprobaciones financieras y 21 de navegador, con ventanas de 1.440 y 390 píxeles. Las pruebas de fallos de almacenamiento y conflictos produjeron los errores simulados esperados y comprobaron la recuperación. La comprobación pública de proveedores queda fuera de esta intervención. Los perfiles de aceptación usan datos sintéticos y bloquean todos los destinos externos.

## F. Integridad patrimonial

Se trabajó sobre código fuente y sobre datos sintéticos en memoria o almacenamiento aislado. La cartera real, cantidades, saldos, lotes, operaciones y respaldos existentes quedaron intactos. Las pruebas controlaron conciliación de cantidades, coste consumido más base restante y patrimonio con reservas activadas.

## G. Seguridad

La evidencia de C se limita a plantillas revisadas y pruebas de representación de texto inerte en perfiles aislados. Ingresos, anotaciones del diario, APY y fichas que reutilizan datos de cartera recibieron correcciones de salida relacionadas. Noticias y el selector remoto de ETFs ya usan mecanismos de texto seguro o codificación, cubiertos por las pruebas existentes. Quedan pendientes una revisión integral de los manejadores HTML aún presentes y una política CSP más estricta, que requieren un trabajo separado. Autenticación, RLS, credenciales y producción quedaron intactas.

## H. Compatibilidad

La certeza es información derivada. El cambio usa los campos existentes, conserva el formato de la cartera y del JSON, y no necesita una migración. Una exportación y una restauración sintéticas conservaron las cantidades, el saldo, el importe histórico de la venta y el máximo exportado. La regresión incluye CAS, conflictos ficticios y reversión ante errores de almacenamiento.

## I. Cambios en resultados derivados

- Ventas antiguas con importe reproducible, pero adquisición sin evidencia suficiente: el importe almacenado puede pasar de apariencia definitiva a provisional. Si falta base comparable, importe neto o conciliación, la vista muestra información insuficiente. Los valores originales del registro se conservan.
- CEDEAR abierto tras una venta parcial: cambia la base ARS mostrada y la G/P no realizada. Ejemplo de aceptación: de `−500 ARS` a `0 ARS`. Una posición solo MEP que conserva únicamente lotes MEP puede volver a mostrar su base comparable tras agotarse un lote de otra moneda.
- Ventas nuevas con varias monedas: los costes consumidos siguen identificados en su moneda original. La vista presenta G/P numérica únicamente si existe evidencia de comparabilidad.
- El patrimonio sigue incluyendo las mismas cotizaciones utilizables. La indicación de antigüedad o conversión estimada cambia la interpretación, no la suma. La revisión propuesta consiste en comparar ambos códigos sobre una copia sintética o sobre un respaldo privado solo cuando el propietario lo autorice, revisando por separado ventas, lotes abiertos y trazabilidad de comisiones.

## J. Riesgos residuales

- Algunas ventas históricas carecen de una cadena verificable de coste. Cuando el importe todavía concilia se muestra como provisional, a la espera de documentación. En CEDEARs, un total idéntico al bruto sin constancia explícita de comisión cero también queda provisional.
- No se ajustan cierres anteriores por comisiones desconocidas ni se inventan conversiones. La equivalencia existente de cotizaciones USDT en la valoración USD queda identificada como estimada. Un cambio de política de conversión o de los umbrales de vigencia requiere aprobación.
- Las reservas siguen siendo informativas. Cualquier bloqueo o aviso al consumir saldo comprometido requiere decisión expresa.
- Las series de patrimonio guardadas anteriormente pueden contener cotizaciones de referencia de distinta antigüedad. No se reclasifican sin los metadatos históricos necesarios.

## K. Plan de publicación y reversión

1. Revisar el informe y aprobar el impacto de los cambios derivados. Separar cualquier propuesta de ajuste de datos reales de la publicación del código.
2. Tras autorización, respaldar con checksum el código servido y registrar la revisión remota. Confirmar que la rama de publicación sigue teniendo la base auditada, revisar las diferencias y preparar un commit limitado a los archivos aprobados.
3. Ejecutar regresión y CI. Publicar el commit aprobado y verificar Pages, igualdad del HTML, la versión visible y las pruebas sintéticas en la URL pública.
4. Para revisar el código anterior ahora, abrir `main` en una copia de trabajo separada, o consultar `7246e28` sin descartar la rama candidata. Tras un eventual despliegue, revertir los commits de la publicación mediante un nuevo commit autorizado y verificar de nuevo Pages. La reversión de código no requiere restaurar ni sustituir la cartera.

## CAMBIOS PREPARADOS Y PENDIENTES DE APROBACIÓN DEL PROPIETARIO

Se entregan A, B, C y D para revisión local. Las pruebas reproducen los cálculos y comprueban la representación en escritorio y móvil. Quedan para aprobación la interpretación de resultados históricos incompletos, cualquier cambio contable o de política de reservas o cotizaciones y la futura publicación según el plan K. La tarea no creó commits ni ejecutó `push`, `merge`, migración ni despliegue.
