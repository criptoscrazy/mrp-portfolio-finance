# Liquidez: alcance y verificacion

Version: `2026-10-06.1`. Publicacion autorizada el 2026-10-06.

## Uso

- Liquidez esta entre Otros y Coste medio por posicion.
- Nuevo saldo introduce el saldo actual y su fecha de inicio. No importa
  movimientos antiguos ni deduce efectivo del Historial existente.
- Cada saldo conserva entidad, moneda, cuenta/producto, disponibilidad y notas.
- Registrar movimiento permite aporte, retiro, transferencia propia y comision.
- Para corregir un saldo sin borrar trazabilidad, registrar aporte o retiro con
  una nota explicativa. La cantidad no se edita silenciosamente.
- Comprar/Vender y las compras iniciales permiten elegir un saldo o
  `Sin afectar Liquidez`. El saldo compatible se propone cuando es inequivoco.
- Si importe y moneda son conocidos, se calcula el efecto neto con comision.
  Si falta comision o la moneda difiere, se pide el importe real debitado o
  acreditado. No se supone una conversion ni una comision cero.
- Las operaciones anteriores al saldo inicial no pueden afectarlo. Usar
  `Sin afectar Liquidez` para compras historicas o fondos no controlados.
- Las importaciones antiguas/CSV no reconstruyen liquidez automaticamente.

## Patrimonio y stablecoins

- Disponible total = inmediata + remunerada de rescate rapido.
- Saldos invertidos/no disponibles se incluyen una sola vez en inversiones.
- Pasar a Liquidez/Pasar a Cripto traslada unidades y el coste conocido. No
  crea compras/ventas ni resultado realizado; mantiene el positionId existente.
- Para una stablecoin no reconocida, declarar primero un saldo cero del tipo
  Stablecoin. La posicion ofrece despues su reclasificacion a ese saldo.
- El coste desconocido permanece pendiente, nunca se reemplaza por cero.
- Al crear una posicion por reclasificacion, no se inventa una primera compra.
- La reclasificacion de disponibilidad queda documentada en Historial.
- Dashboard separa inversiones, inmediata, remunerada, disponible total y
  patrimonio financiero. El coste abierto sigue siendo una metrica separada.
- Las curvas/snapshots existentes conservan su alcance de inversiones;
  no se reescriben como una serie historica de efectivo o patrimonio total.

## Conversion e integridad

- USD es la unidad base. Para otras monedas se registra USD por unidad,
  fuente y fecha/hora. No se supone que USDT/USDC valgan un dolar.
- Una cotizacion real de una posicion stablecoin puede conservarse al
  reclasificar. No se agregaron nuevos proveedores ni servicios.
- Cotizaciones ausentes, futuras o con mas de 96 horas quedan pendientes.
  Los totales parciales identifican el numero de saldos sin valorar.
- Las transferencias entre monedas requieren el importe realmente recibido.
  Una comision reduce patrimonio por su importe, no por la transferencia.
- La operacion, posicion y saldo se guardan juntos. Si falla la persistencia,
  se revierten y no se programa una sincronizacion del cambio fallido.
- Antes del primer cambio se guarda una copia local previa en
  `mrp_before_liquidity_v1`. No se descargaron datos reales de la cartera.
- Los nuevos campos se incluyen en backup/sincronizacion V3 existente;
  no hay migracion de tablas ni cambios en Supabase.
- Antes de controlar saldos reales, todos los accesos deben estar en esta
  version: versiones anteriores no coordinan compras/ventas con Liquidez.

## Pruebas reproducibles

```sh
node tests/regression.cjs
node tests/liquidity.cjs
node tests/liquidity-visual.cjs
node tests/context-metrics-visual.cjs
```

Solo fixtures sinteticas, almacenamiento aislado y red externa bloqueada.
Capturas desktop/movil en `/private/tmp/mrp-liquidity-*.png`.
