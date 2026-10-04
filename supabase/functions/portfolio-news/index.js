import { XMLParser } from "npm:fast-xml-parser@5.11.2";

// The standalone file has a null origin; this endpoint serves public RSS only.
const allowedOrigins = new Set(["https://criptoscrazy.github.io", "null"]);
const cache = new Map();
const requests = new Map();
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
const text = value => typeof value === "string" ? value : String(value?.["#text"] || "");
const kinds = new Set(["crypto", "stock", "etf", "cedear", "bond", "other"]);

function safeLink(value) {
  try {
    let url = new URL(value);
    if (url.hostname === 'www.bing.com' && url.pathname === '/news/apiclick.aspx') url = new URL(url.searchParams.get('url'));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function parseFeed(xml, symbol, language) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Unsupported XML declarations");
  const channel = parser.parse(xml)?.rss?.channel;
  if (!channel) throw new Error("Invalid RSS feed");
  const entries = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
  return entries.slice(0, 8).map(item => {
    const title = text(item.title).slice(0, 500);
    const link = safeLink(text(item.link));
    const date = Date.parse(text(item.pubDate));
    return { sym: symbol, title, link, description: "", source: text(item.source || item['News:Source']).slice(0, 120) || "RSS público",
      pubDate: Number.isFinite(date) ? new Date(date).toISOString() : null, language, image: null };
  }).filter(item => item.title && item.link);
}

async function readFeed(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(3500), redirect: "error" });
  if (!response.ok || !response.body) throw new Error("Feed HTTP " + response.status);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) throw new Error("Feed too large");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

function feedUrl(asset, language, provider) {
  const term = asset.kind === "etf" ? asset.symbol : asset.name || asset.symbol;
  const topic = asset.kind === "crypto" ? (language === "es" ? "criptomoneda" : "crypto")
    : asset.kind === "etf" ? "ETF" : language === "es" ? "finanzas" : "finance";
  if(provider==='bing'){
    const url=new URL('https://www.bing.com/news/search');
    url.search=new URLSearchParams({q:`"${term}" ${topic}`,format:'rss',setlang:language==='es'?'es-es':'en-us',cc:language==='es'?'es':'us',qft:'interval="7"',sortby:'date'}).toString();
    return url;
  }
  const url = new URL("https://news.google.com/rss/search");
  url.search = new URLSearchParams({ q: `"${term}" ${topic} when:7d`, hl: language,
    gl: language === "es" ? "ES" : "US", ceid: language === "es" ? "ES:es" : "US:en" }).toString();
  return url;
}

export async function handler(req) {
  const origin = req.headers.get("Origin") || "";
  const headers = { "Content-Type": "application/json", "Vary": "Origin", "Cache-Control": "no-store" };
  if (allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowedOrigins.has(origin)) return reply({ error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const ip = (req.headers.get("x-forwarded-for") || "unknown").slice(0, 80);
  const minute = Math.floor(Date.now() / 60000);
  const count = requests.get(ip);
  if (count?.minute === minute && count.total >= 60) return reply({ error: "Rate limit" }, 429);
  if (requests.size >= 512) requests.clear();
  requests.set(ip, { minute, total: count?.minute === minute ? count.total + 1 : 1 });
  let asset;
  try {
    const body = await req.text();
    if (body.length > 1024) return reply({ error: "Request too large" }, 413);
    asset = JSON.parse(body);
    if (!asset || typeof asset !== "object" || Array.isArray(asset) ||
      Object.keys(asset).some(key => !["symbol", "name", "kind"].includes(key)) ||
      typeof asset.symbol !== "string" || !/^[A-Z0-9.^=-]{1,24}$/.test(asset.symbol) ||
      !kinds.has(asset.kind) || typeof asset.name !== "string" || asset.name.length > 100 ||
      /[<>"\\\r\n]/.test(asset.name)) return reply({ error: "Invalid asset" }, 400);
  } catch { return reply({ error: "Invalid request" }, 400); }
  const key = JSON.stringify(asset);
  const saved = cache.get(key);
  if (saved && Date.now() - saved.time < 10 * 60000) return reply(saved.result);
  let items = [];
  let sourceResponded = false;
  for (const language of ["es", "en"]) {
    for(const provider of ['google','bing']){
      try {
        items = parseFeed(await readFeed(feedUrl(asset, language, provider)), asset.symbol, language);
        sourceResponded = true;
        if (items.length) break;
      } catch (error) { console.warn("Public RSS unavailable", provider, language, String(error.message).slice(0, 160)); }
    }
    if(items.length)break;
  }
  if (!sourceResponded) return reply({ error: "News sources unavailable" }, 502);
  const result = { items, fetchedAt: new Date().toISOString() };
  if (cache.size >= 128) cache.delete(cache.keys().next().value);
  cache.set(key, { time: Date.now(), result });
  return reply(result);
}

Deno.serve(handler);
