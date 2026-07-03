# MRP Portfolio

Tracker de inversiones personal, completo y privado. Acciones, cripto, CEDEARs, ETFs, bonos, tokenizadas, Trading Desk profesional y sincronización en la nube — todo en una sola app web, sin instalación.

## 🚀 Uso

**[👉 Abrir MRP Portfolio](https://criptoscrazy.github.io/mrp-portfolio-finance/)**

Funciona directo en el navegador, en Mac, Windows o iPhone. No requiere descargar nada.

## ✨ Funcionalidades completas

### 📊 Dashboard
- Resumen ejecutivo: valor total, G/P no realizada, capital invertido
- Métricas avanzadas: IRR anualizado, Sharpe Ratio, Beta vs S&P 500
- Distribución del portafolio por clase de activo y por custodio (broker/exchange/wallet)
- Comparador de rentabilidad vs S&P 500 (SPY) y Bitcoin
- Gráficos de rentabilidad por activo y G/P en USD

### 💼 Clases de activos soportadas
- **Acciones**: con sector, stop loss, target, broker/custodio
- **Cripto**: con tipo de custodia (exchange/hot/cold/DeFi), wallet, dirección
- **CEDEARs**: ratio de conversión, precio en ARS, cálculo automático de valor en USD vía CCL
- **ETFs**: tipo de fondo, índice que replica, expense ratio (TER)
- **Acciones tokenizadas**: tipo de respaldo (custodiado 1:1 / sintético), exchange
- **Bonos**: soberanos AR, Treasuries US, corporativos, ONs, plazos fijos — con cálculo de interés anual

### 🧮 Promedio DCA
Precio promedio ponderado de compra cruzado con historial de operaciones, por activo.

### 🛡️ Riesgo
Exposición por activo y por sector, medidores de Sharpe Ratio y Beta.

### 💰 Ingresos pasivos
- Registro de dividendos, cupones de bonos, staking, intereses
- Módulo APY/APR con cálculo automático de ingreso mensual y anual proyectado
- Posiciones de staking, lending, liquidity pools y plazos fijos

### 📜 Historial
- Log completo de operaciones
- Importador nativo de archivos Binance (XLSX) con vista previa, filtros y detección de duplicados
- Importador CSV genérico para otros exchanges

### 📈 Evolución
Snapshots automáticos del valor del portafolio en el tiempo (se guardan solos al actualizar precios), gráfico de evolución total y por activo.

### 📺 Gráficos técnicos
Widgets de TradingView embebidos por activo, con selector de timeframe.

### 📰 Noticias
Feed de noticias filtrado por los activos de tu cartera, vía Yahoo Finance y CoinDesk, con múltiples fuentes de respaldo para máxima disponibilidad.

### 🖥️ Trading Desk
Suite completa para trading activo, separada del tracking de inversión a largo plazo:
- **Posiciones**: registro de operaciones LONG/SHORT con P&L en vivo, ratio R, curva de capital
- **Diario de trading**: registro de cada operación con señal de entrada, contexto, errores cometidos y lecciones aprendidas
- **Checklist de entrada**: lista personalizable con score automático antes de operar
- **Calculadora de posición**: tamaño exacto según capital y % de riesgo, límites diarios/mensuales
- **Watchlist**: activos en seguimiento con ratio riesgo/beneficio y tesis de inversión
- **Psicología**: registro diario de estado mental (descanso, concentración, estrés) correlacionado con resultados
- **Performance**: win rate, expectativa matemática, drawdown máximo, mejores y peores operaciones
- **Reglas**: tu manifiesto de trading y reglas personales organizadas por categoría

### 🔔 Alertas de precio
Definís condiciones (sube sobre / baja de determinado precio) y la app te avisa visualmente al actualizar.

### ☁️ Sincronización en la nube
- Login con tu cuenta de GitHub (vía Supabase)
- Sincronización automática entre dispositivos (Mac, iPhone, cualquier navegador)
- Resolución inteligente de conflictos basada en marca de tiempo — nunca perdés datos por usar la app en dos lugares
- Actualización automática de precios cada 3 minutos (pausada si la pestaña no está visible, para cuidar batería y APIs)

### 🎨 Personalización
- Modo oscuro / claro con paleta accesible (contraste verificado WCAG AA)
- Español / Inglés
- Diseño responsive: barra de navegación inferior en iPhone, layout completo en desktop

## 🔒 Privacidad y seguridad

Tus datos viven en `localStorage` de tu navegador. Si conectás tu cuenta de GitHub, se sincronizan además en una base de datos Supabase protegida con **Row Level Security** — la política de seguridad de la base de datos impide que cualquier otro usuario, incluso con acceso al proyecto, pueda leer o escribir tus datos. Solo vos, autenticado con tu cuenta, podés acceder a tu información.

## 🛠️ Stack técnico

- **Frontend**: HTML/CSS/JavaScript puro en un solo archivo, sin frameworks ni build
- **Gráficos**: Chart.js
- **Backend de sincronización**: Supabase (PostgreSQL + Auth)
- **Precios en tiempo real**: CoinGecko API, Yahoo Finance
- **Gráficos técnicos**: TradingView embed

## 📱 Instalar como app (acceso directo)

### En Mac (Chrome/Edge)
1. Abrí la app en el navegador
2. Menú del navegador (⋮ o Compartir) → **"Instalar [nombre]..."** o **"Crear acceso directo..."**
3. Quedará como un ícono en el Dock/Launchpad, se abre en su propia ventana sin la barra del navegador

### En iPhone (Safari)
1. Abrí la app en Safari
2. Tocá el ícono de Compartir (cuadrado con flecha hacia arriba)
3. **"Agregar a pantalla de inicio"**
4. Quedará como un ícono más, se abre a pantalla completa como una app nativa

## 📝 Notas

Proyecto personal en desarrollo continuo. Roadmap y decisiones de diseño documentadas en el historial de conversación con Claude.

---

*Construido con [Claude](https://claude.ai) de Anthropic.*
