const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/Users/marcos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');

const appPath = path.resolve(__dirname, '..', 'index.html');
const screenshotPath = '/private/tmp/mrp-portfolio-cedear-visual.png';
const mobileScreenshotPath = '/private/tmp/mrp-portfolio-cedear-mobile.png';

const lot = (id, sym, date, quantity, unit, total, ticket, ratio = '10') => ({
  id, type: 'cedeaar', sym, name: sym === 'AAPL' ? 'Apple Inc.' : sym,
  date, purchaseCurrency: 'USD_MEP', quantityDecimal: quantity, ratioDecimal: ratio,
  unitPriceDecimal: unit, grossAmountDecimal: null, totalCostDecimal: total,
  ticketNumber: ticket, informationSource: 'Prueba visual', schemaVersion: 'cedear-lots-v1',
  qty: Number(quantity), ratio: Number(ratio), broker: 'Prueba', note: ''
});

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--allow-file-access-from-files']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('http://**/*', route => route.abort());
  await page.route('https://**/*', route => route.abort());
  await page.goto(pathToFileURL(appPath).href, { waitUntil: 'domcontentloaded' });
  // Dejar finalizar la inicialización normal antes de inyectar los datos de
  // prueba; de lo contrario su pestaña por defecto puede competir con Otros.
  await page.waitForTimeout(900);
  await page.evaluate(lots => {
    localStorage.clear();
    ST = {
      stocks: [], crypto: [], hist: [], income: [], apyPositions: [], alerts: [],
      otros: lots, cedearExpenses: [], cedearValuations: [], snaps: [], aSnaps: {}, selAsset: null,
      cedearCurrentCclDecimal: '1200', cedearCurrentCclSource: 'Prueba visual',
      cedearCurrentCclUpdatedAt: '2026-08-04T10:00:00.000Z'
    };
    ST.otros.forEach(item => { item.cur = 24000; item.ch = .01; item.priceSource = 'Yahoo Finance · BYMA'; item.priceUpdatedAt = '2026-08-04T10:00:00.000Z'; item.quoteSymbol = `${item.sym}.BA`; });
    renderAll(); showTab('otros'); showOtrosTab('cedeares');
  }, [
    lot('a1', 'AAPL', '2025-07-29', '281', '10.6500', '3013.29', '874213'),
    lot('a2', 'AAPL', '2025-08-06', '279', '10.7778', '3027.75', '918256'),
    lot('a3', 'AAPL', '2025-08-08', '204', '11.2000', '2300.55', '932233'),
    lot('a4', 'AAPL', '2025-09-16', '58', '12.0100', '701.38', '1122656')
  ]);
  // La sección entra con una animación breve. Esperar evita capturarla con
  // opacidad inicial y hace que la revisión visual represente la UI real.
  await page.waitForTimeout(350);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const result = await page.evaluate(() => ({
    visible: document.querySelector('#otrosSection-cedeares')?.style.display !== 'none',
    tableText: document.querySelector('#cedTb')?.innerText || '',
    lotsButton: Boolean([...document.querySelectorAll('#cedTb button')].find(button => button.textContent.includes('Ver lotes'))),
    timelineText: document.querySelector('#cedTimelineTb')?.innerText || '',
    activeTab: document.querySelector('.tab.active')?.textContent?.trim() || '',
    openOverlays: [...document.querySelectorAll('.modal-overlay.open')].map(element => element.id),
    syncOverlay: getComputedStyle(document.querySelector('#syncBlockOverlay')).display,
    contentOpacity: getComputedStyle(document.querySelector('#tab-otros')).opacity,
    formLabelColor: getComputedStyle(document.querySelector('#otrosSection-cedeares label')).color,
    tableTextColor: getComputedStyle(document.querySelector('#cedTb')).color,
    sectionBackground: getComputedStyle(document.querySelector('#tab-otros')).backgroundColor,
    bodyFilter: getComputedStyle(document.body).filter,
    coverElements: [...document.querySelectorAll('*')].filter(element => {
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      return style.position === 'fixed' && style.display !== 'none' && rect.width >= innerWidth && rect.height >= innerHeight;
    }).map(element => ({ id: element.id, className: element.className, opacity: getComputedStyle(element).opacity, background: getComputedStyle(element).backgroundColor, zIndex: getComputedStyle(element).zIndex }))
  }));
  if (!result.visible || result.activeTab !== 'Otros' || !result.tableText.includes('822') || !result.tableText.includes('9.042,97') || !result.lotsButton) {
    throw new Error(`Render CEDEAR incompleto: ${JSON.stringify(result)}`);
  }
  if (pageErrors.length) throw new Error(`Errores JavaScript visuales: ${pageErrors.join(' | ')}`);
  await page.locator('#cedCurrency').selectOption('USD_CABLE');
  const dynamicForm = await page.evaluate(() => ({
    unitLabel: document.querySelector('#cedUnitPriceLabel')?.textContent || '',
    totalLabel: document.querySelector('#cedTotalLabel')?.textContent || ''
  }));
  if (!dynamicForm.unitLabel.includes('USD cable') || !dynamicForm.totalLabel.includes('USD cable')) {
    throw new Error(`El formulario no actualiza etiquetas por moneda: ${JSON.stringify(dynamicForm)}`);
  }
  await page.locator('#cedTb button').click();
  const lotModal = await page.evaluate(() => ({
    open: document.querySelector('#cedLotsModalOverlay')?.classList.contains('open'),
    rows: document.querySelectorAll('#cedLotsTb tr').length,
    text: document.querySelector('#cedLotsTb')?.innerText || ''
  }));
  if (!lotModal.open || lotModal.rows !== 4 || !lotModal.text.includes('874213') || !lotModal.text.includes('1122656')) {
    throw new Error(`El detalle de lotes no está completo: ${JSON.stringify(lotModal)}`);
  }
  await page.locator('#cedLotsModalOverlay .btn-save').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
  const mobile = await page.evaluate(() => {
    const form = document.querySelector('#otrosSection-cedeares .form-row:nth-of-type(2)');
    return { formFits: Boolean(form) && form.scrollWidth <= form.clientWidth + 1, viewport: innerWidth };
  });
  if (!mobile.formFits) throw new Error(`El formulario CEDEAR desborda en móvil: ${JSON.stringify(mobile)}`);
  console.log(JSON.stringify({ ok: true, screenshotPath, mobileScreenshotPath, mobile, dynamicForm, lotModal, ...result }));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
