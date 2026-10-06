# Gestion de beneficios: etapa 1

Implementacion local para revision. Version 2026-10-06.3.

Los umbrales generales de ganancia y concentracion empiezan sin definir. No hay
porcentajes definitivos ni provisionales. Target usa exclusivamente `tg` de la
posicion de Acciones, expresado en USD y con cotizacion comparable vigente.

Las reglas reciben `portfolioSummary()` y sus valoraciones. Rentabilidad = G/P
no realizada / coste abierto. Peso = valor de posicion / valor de inversiones.
La liquidez inmediata y remunerada no entra en el denominador; los productos
invertidos no disponibles conservan su inclusion actual en Riesgo.

Cada aviso pertenece a un `positionId` y custodio. El detalle muestra tambien
el peso consolidado del instrumento mediante `consolidatedExposure()`.
La alerta de concentracion usa el peso individual de la posicion. No se activa
si hay inversiones pendientes de valorar o precios antiguos en el denominador.

Ganancia relevante requiere umbral y rentabilidad >= umbral. Ganancia mas
concentracion requiere ambos umbrales. Target alcanzado requiere precio >= tg.
Revision parcial requiere rentabilidad positiva y dos factores independientes
habilitados: ganancia, concentracion, target. Una combinacion no cuenta dos veces.
Prioridad alta indica coincidencia de factores; media, target; informativa,
ganancia aislada. No produce operaciones, ordenes ni porcentajes de venta.

El detalle de la ultima venta usa Historial vinculado por positionId. Porcentaje
restante = qtyAfter / qtyBefore, referido a esa venta, no a compras posteriores.
Si faltan cantidades historicas (incluidas ventas actuales de CEDEARs), muestra
N/D. Beneficio realizado y liquidez liberada se presentan por separado y en sus
monedas originales. Comision desconocida deja el beneficio realizado pendiente.
Comprar/Vender, lotes, saldos y snapshots mantienen su mecanica existente.

Configuracion opcional `profitReview`, validada y incluida en la persistencia,
backup y sincronizacion V3 existente. Los calculos de revision no escriben datos.
La configuracion se guarda con la transaccion de persistencia ya existente.

Etapa 2 pendiente: seguimiento de maximos y proteccion de ganancias. El maximo
de precio observado NO debe reiniciarse por compra adicional mientras coincidan
positionId, moneda y unidad. La maxima rentabilidad se tratara separadamente,
porque las compras pueden cambiar el coste medio. No se implementa en etapa 1.

Se incluye el ajuste solicitado de version visible: 8 px -> 9 px.
