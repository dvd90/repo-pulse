import { Hono } from "hono";
import { parseEnv } from "../env.js";
import type { AppEnv } from "../types.js";

/**
 * Human-facing landing page at `GET /` (free). Self-contained HTML/CSS/JS — no
 * external assets — so the Worker serves it whole from the edge. Themed for
 * light and dark. Design: a "vitals instrument" readout (monospace display,
 * graphite ground, amber signal accent, a live specimen scorecard).
 */
export const landingRoutes = new Hono<AppEnv>();

landingRoutes.get("/", (c) => {
  let price = "$0.01";
  let network = "Base";
  try {
    const cfg = parseEnv(c.env);
    price = cfg.X402_PRICE_USD;
    network = cfg.X402_NETWORK === "eip155:8453" ? "Base" : cfg.X402_NETWORK;
  } catch {
    // keep defaults if config is momentarily invalid
  }
  const origin = new URL(c.req.url).origin;
  return c.html(page(origin, price, network));
});

// Sample specimen shown on the page — mirrors the schema example (honojs/hono).
const SAMPLE: Array<[string, number, string]> = [
  ["commit recency", 100, "0d since last commit"],
  ["release cadence", 88, "3 in 90d"],
  ["issue hygiene", 82, "0.86 close ratio"],
  ["pr flow", 90, "0.78 merged · 20h"],
  ["bus factor", 74, "6 effective authors"],
  ["ci presence", 100, "workflows found"],
  ["test presence", 100, "test suite found"],
  ["docs", 92, "readme · license · docs/"],
  ["dep freshness", 80, "0.80 pinned"],
];

function bandColor(score: number): string {
  if (score >= 90) return "var(--gA)";
  if (score >= 75) return "var(--gB)";
  if (score >= 60) return "var(--gC)";
  if (score >= 40) return "var(--gD)";
  return "var(--gF)";
}

function signalRows(): string {
  return SAMPLE.map(([label, score, note]) => {
    const c = bandColor(score);
    return (
      '<div class="row">' +
      '<div class="rlabel">' +
      label +
      "</div>" +
      '<div class="track"><i style="width:' +
      score +
      "%;background:" +
      c +
      '"></i></div>' +
      '<div class="rscore" style="color:' +
      c +
      '">' +
      score +
      "</div>" +
      '<div class="rnote">' +
      note +
      "</div>" +
      "</div>"
    );
  }).join("");
}

function page(origin: string, price: string, network: string): string {
  return (
    '<!doctype html><html lang="en"><head>' +
    '<meta charset="utf-8"/>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"/>' +
    "<title>RepoPulse — repository vitals, priced per call</title>" +
    '<meta name="description" content="A deterministic 0-100 health score for any public GitHub repository. ' +
    price +
    " per call, paid over HTTP with x402 on " +
    network +
    '."/>' +
    "<style>" +
    STYLE +
    "</style></head><body>" +
    // ── hero ───────────────────────────────────────────────────────────
    '<canvas id="pulse" aria-hidden="true"></canvas>' +
    '<div class="shell">' +
    '<header class="top">' +
    '<div class="mark"><span class="dot"></span>RepoPulse</div>' +
    '<div class="meta">v1 · deterministic · ' +
    network +
    "</div>" +
    "</header>" +
    '<section class="hero">' +
    "<h1>Take a repository&rsquo;s<br/><em>pulse</em> in one request.</h1>" +
    '<p class="lede">Point it at any public GitHub repo and get back a 0&ndash;100 health score with a nine-signal readout &mdash; commit rhythm, PR flow, bus factor, tests, docs and more. Same repo state, same score, every time.</p>' +
    '<div class="tags"><span class="pill price">' +
    price +
    ' / call</span><span class="pill">x402 &middot; USDC</span><span class="pill">no account, no key</span></div>' +
    "</section>" +
    // ── specimen scorecard ─────────────────────────────────────────────
    '<section class="panel" aria-label="Example report">' +
    '<div class="phead"><span class="tick">SPECIMEN</span> honojs/hono</div>' +
    '<div class="pbody">' +
    '<div class="gauge">' +
    ringSvg(91) +
    '<div class="gsummary"><div class="gsub">grade</div><div class="ggrade">A</div>' +
    "<p>Actively maintained with strong CI, tests, and a healthy contributor base.</p></div>" +
    "</div>" +
    '<div class="signals">' +
    signalRows() +
    "</div>" +
    "</div></section>" +
    // ── protocol (a real sequence, hence numbered) ─────────────────────
    '<section class="proto">' +
    "<h2>How a machine pays for it</h2>" +
    "<ol>" +
    "<li><b>Ask.</b> The agent calls <code>GET /v1/health?repo=owner/name</code> &mdash; no key attached.</li>" +
    "<li><b>402.</b> The server answers <em>Payment Required</em> and states its terms in a header: " +
    price +
    " USDC on " +
    network +
    ", pay-to address, deadline.</li>" +
    "<li><b>Sign.</b> The agent signs a one-shot, gasless USDC authorization for exactly that amount and retries with a <code>PAYMENT-SIGNATURE</code>.</li>" +
    "<li><b>Settle.</b> A facilitator verifies and settles on-chain; the server returns <code>200</code> and the report. The wallet is the whole identity.</li>" +
    "</ol>" +
    '<p class="foot-note">With <code>@x402/fetch</code> the four steps collapse into one wrapped <code>fetch()</code>. The endpoint self-describes in the x402 Bazaar, so agents can discover and call it unattended.</p>' +
    "</section>" +
    // ── endpoints spec ─────────────────────────────────────────────────
    '<section class="spec">' +
    "<h2>Endpoints</h2>" +
    '<div class="table">' +
    specRow("GET", "/v1/health?repo={owner}/{name}", price, "The score. Paid via x402.") +
    specRow("GET", "/v1/schema", "free", "Response JSON Schema + active weights.") +
    specRow("GET", "/healthz", "free", "Liveness.") +
    specRow("GET", "/readyz", "free", "Config, cache & facilitator checks.") +
    "</div>" +
    '<pre class="term"><span class="c">$</span> curl -i "' +
    origin +
    '/v1/health?repo=honojs/hono"\n' +
    '<span class="dim">HTTP/1.1 402 Payment Required</span>\n' +
    '<span class="dim">payment-required: eyJ4NDAyVmVyc2lvbiI6Mi4uLg</span></pre>' +
    "</section>" +
    '<footer class="end">' +
    "<span>Runs on Cloudflare Workers.</span>" +
    '<span><a href="' +
    origin +
    '/v1/schema">schema</a> &middot; <a href="https://github.com/dvd90/repo-pulse">source</a> &middot; MIT</span>' +
    "</footer>" +
    "</div>" +
    "<script>" +
    SCRIPT +
    "</script>" +
    "</body></html>"
  );
}

function ringSvg(score: number): string {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  return (
    '<svg class="ring" viewBox="0 0 120 120" role="img" aria-label="Score ' +
    score +
    ' of 100">' +
    '<circle cx="60" cy="60" r="52" class="ring-bg"/>' +
    '<circle cx="60" cy="60" r="52" class="ring-fg" stroke-dasharray="' +
    filled +
    " " +
    (circ - filled) +
    '" transform="rotate(-90 60 60)"/>' +
    '<text x="60" y="60" class="ring-num">' +
    score +
    "</text>" +
    '<text x="60" y="79" class="ring-cap">/ 100</text>' +
    "</svg>"
  );
}

function specRow(method: string, path: string, price: string, desc: string): string {
  const paid = price !== "free";
  return (
    '<div class="trow">' +
    '<span class="m">' +
    method +
    "</span>" +
    '<code class="p">' +
    path +
    "</code>" +
    '<span class="pr ' +
    (paid ? "paid" : "") +
    '">' +
    price +
    "</span>" +
    '<span class="d">' +
    desc +
    "</span>" +
    "</div>"
  );
}

const STYLE = `
:root{
  --ground:#0c0f12; --panel:#12161b; --panel2:#0f1418; --line:#232b33;
  --ink:#e6ecf1; --muted:#8b97a1; --signal:#f4b740; --signal-dim:#8a6a24;
  --gA:#38b24a; --gB:#7bbf3a; --gC:#d4a017; --gD:#e07b39; --gF:#e5484d;
  --mono:ui-monospace,"SF Mono","JetBrains Mono","DejaVu Sans Mono",Menlo,Consolas,monospace;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
}
@media (prefers-color-scheme: light){
  :root{ --ground:#f5f6f4; --panel:#ffffff; --panel2:#fbfcfa; --line:#e3e6e0;
    --ink:#161a1e; --muted:#5b666f; --signal:#b3741a; --signal-dim:#d9b060; }
}
:root[data-theme="dark"]{ --ground:#0c0f12; --panel:#12161b; --panel2:#0f1418; --line:#232b33; --ink:#e6ecf1; --muted:#8b97a1; --signal:#f4b740; }
:root[data-theme="light"]{ --ground:#f5f6f4; --panel:#ffffff; --panel2:#fbfcfa; --line:#e3e6e0; --ink:#161a1e; --muted:#5b666f; --signal:#b3741a; }
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--ground);color:var(--ink);font-family:var(--sans);
  -webkit-font-smoothing:antialiased;line-height:1.6;position:relative;overflow-x:hidden}
#pulse{position:absolute;top:0;left:0;width:100%;height:340px;opacity:.5;pointer-events:none;z-index:0}
.shell{position:relative;z-index:1;max-width:900px;margin:0 auto;padding:28px 24px 72px}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.mark{font-family:var(--mono);font-weight:700;font-size:15px;letter-spacing:.06em;
  text-transform:uppercase;display:flex;align-items:center;gap:9px}
.dot{width:9px;height:9px;border-radius:50%;background:var(--signal);
  box-shadow:0 0 0 0 var(--signal);animation:beat 2.4s ease-out infinite}
@keyframes beat{0%{box-shadow:0 0 0 0 rgba(244,183,64,.5)}70%{box-shadow:0 0 0 9px rgba(244,183,64,0)}100%{box-shadow:0 0 0 0 rgba(244,183,64,0)}}
.meta{font-family:var(--mono);font-size:12px;color:var(--muted);letter-spacing:.03em}
.hero{padding:64px 0 40px;max-width:44ch}
h1{font-family:var(--mono);font-weight:700;font-size:clamp(34px,6.2vw,56px);
  line-height:1.04;letter-spacing:-.02em;margin:0;text-wrap:balance}
h1 em{font-style:normal;color:var(--signal)}
.lede{font-size:clamp(16px,2.4vw,19px);color:var(--muted);max-width:56ch;margin:22px 0 26px}
.tags{display:flex;gap:8px;flex-wrap:wrap}
.pill{font-family:var(--mono);font-size:12px;letter-spacing:.02em;padding:6px 11px;
  border:1px solid var(--line);border-radius:2px;color:var(--muted);background:var(--panel2)}
.pill.price{color:var(--ground);background:var(--signal);border-color:var(--signal);font-weight:700}
:root[data-theme="light"] .pill.price,:root:not([data-theme="dark"]) .pill.price{color:#1a1200}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .pill.price{color:#1a1200}}
h2{font-family:var(--mono);font-size:13px;text-transform:uppercase;letter-spacing:.14em;
  color:var(--muted);margin:0 0 18px;font-weight:600}
.panel{border:1px solid var(--line);border-radius:4px;background:var(--panel);
  margin-top:20px;overflow:hidden}
.phead{font-family:var(--mono);font-size:13px;padding:13px 18px;border-bottom:1px solid var(--line);
  color:var(--ink);display:flex;align-items:center;gap:12px;background:var(--panel2)}
.tick{font-size:10px;letter-spacing:.16em;color:var(--signal);border:1px solid var(--signal-dim);
  padding:2px 6px;border-radius:2px}
.pbody{display:grid;grid-template-columns:220px 1fr;gap:8px}
@media(max-width:640px){.pbody{grid-template-columns:1fr}}
.gauge{padding:26px 20px;border-right:1px solid var(--line);text-align:center}
@media(max-width:640px){.gauge{border-right:none;border-bottom:1px solid var(--line)}}
.ring{width:150px;height:150px;display:block;margin:0 auto}
.ring-bg{fill:none;stroke:var(--line);stroke-width:9}
.ring-fg{fill:none;stroke:var(--gA);stroke-width:9;stroke-linecap:round;
  transition:stroke-dasharray 1s ease}
.ring-num{fill:var(--ink);font-family:var(--mono);font-size:34px;font-weight:700;
  text-anchor:middle;dominant-baseline:middle}
.ring-cap{fill:var(--muted);font-family:var(--mono);font-size:10px;text-anchor:middle;letter-spacing:.1em}
.gsummary{margin-top:14px}
.gsub{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.ggrade{font-family:var(--mono);font-size:40px;font-weight:700;color:var(--gA);line-height:1}
.gsummary p{font-size:13px;color:var(--muted);margin:10px 0 0}
.signals{padding:18px 20px;display:flex;flex-direction:column;gap:11px;justify-content:center}
.row{display:grid;grid-template-columns:112px 1fr 34px;grid-template-areas:"l t s" "n n n";
  gap:4px 12px;align-items:center}
.rlabel{grid-area:l;font-size:12.5px;color:var(--muted)}
.track{grid-area:t;height:6px;background:var(--line);border-radius:3px;overflow:hidden}
.track i{display:block;height:100%;border-radius:3px}
.rscore{grid-area:s;font-family:var(--mono);font-size:13px;font-weight:600;text-align:right;
  font-variant-numeric:tabular-nums}
.rnote{grid-area:n;font-family:var(--mono);font-size:10.5px;color:var(--muted);opacity:.7;
  padding-left:124px;margin-top:-2px}
@media(max-width:640px){.rnote{display:none}}
.proto{margin-top:52px}
.proto ol{list-style:none;counter-reset:s;padding:0;margin:0;display:grid;gap:2px}
.proto li{counter-increment:s;position:relative;padding:16px 0 16px 52px;border-top:1px solid var(--line);font-size:15px}
.proto li:last-child{border-bottom:1px solid var(--line)}
.proto li::before{content:counter(s,decimal-leading-zero);position:absolute;left:0;top:16px;
  font-family:var(--mono);font-size:12px;color:var(--signal);letter-spacing:.05em}
.proto b{color:var(--ink)}
.foot-note{color:var(--muted);font-size:14px;margin-top:20px;max-width:64ch}
code{font-family:var(--mono);font-size:.88em;background:var(--panel2);border:1px solid var(--line);
  padding:1px 6px;border-radius:3px}
.spec{margin-top:52px}
.table{border:1px solid var(--line);border-radius:4px;overflow:hidden}
.trow{display:grid;grid-template-columns:52px minmax(0,1.4fr) 62px 1.6fr;gap:14px;align-items:center;
  padding:12px 16px;border-top:1px solid var(--line);font-size:13.5px}
.trow:first-child{border-top:none}
.trow .m{font-family:var(--mono);font-size:11px;color:var(--signal);font-weight:700;letter-spacing:.05em}
.trow .p{background:none;border:none;padding:0;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.trow .pr{font-family:var(--mono);font-size:12px;color:var(--muted);text-align:right;font-variant-numeric:tabular-nums}
.trow .pr.paid{color:var(--signal)}
.trow .d{color:var(--muted);font-size:13px}
@media(max-width:640px){.trow{grid-template-columns:44px 1fr;grid-template-areas:"m p" "pr d"}
  .trow .m{grid-area:m}.trow .p{grid-area:p}.trow .pr{grid-area:pr;text-align:left}.trow .d{grid-area:d}}
.term{font-family:var(--mono);font-size:12.5px;background:var(--panel2);border:1px solid var(--line);
  border-radius:4px;padding:16px;margin-top:18px;overflow-x:auto;line-height:1.7;color:var(--ink)}
.term .c{color:var(--signal);user-select:none}
.term .dim{color:var(--muted)}
.end{margin-top:56px;padding-top:20px;border-top:1px solid var(--line);display:flex;
  justify-content:space-between;gap:12px;flex-wrap:wrap;font-family:var(--mono);font-size:12px;color:var(--muted)}
.end a{color:var(--signal);text-decoration:none}
.end a:hover{text-decoration:underline}
a:focus-visible,.end a:focus-visible{outline:2px solid var(--signal);outline-offset:3px;border-radius:2px}
@media(prefers-reduced-motion:reduce){.dot{animation:none}}
`;

// Canvas heartbeat sweep behind the hero. No template literals / no "$" tokens
// so this stays safe inside the page() template string.
const SCRIPT = `
(function(){
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cv = document.getElementById("pulse");
  if(!cv) return;
  var ctx = cv.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio||1, 2);
  var W=0,H=0;
  function css(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function size(){ W=cv.clientWidth; H=cv.clientHeight; cv.width=W*dpr; cv.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
  size(); window.addEventListener("resize", size);
  // one heartbeat cycle as a function of x within a period
  function beat(t){
    var x = t % 1;
    if(x<0.30) return 0;
    if(x<0.34) return -0.12*Math.sin((x-0.30)/0.04*Math.PI);
    if(x<0.40){ var p=(x-0.34)/0.06; return (p<0.5? p*2 : (1-p)*2); }         // spike up
    if(x<0.46){ var q=(x-0.40)/0.06; return -(q<0.5? q*2 : (1-q)*2)*0.9; }     // dip
    if(x<0.52){ var r=(x-0.46)/0.06; return (r<0.5? r*2 : (1-r)*2)*0.25; }
    return 0;
  }
  var phase=0;
  function draw(){
    ctx.clearRect(0,0,W,H);
    var mid=H*0.5, amp=H*0.34, sig=css("--signal")||"#f4b740";
    ctx.lineWidth=1.6; ctx.strokeStyle=sig; ctx.globalAlpha=0.9;
    ctx.beginPath();
    var periods=2.2, step=2;
    for(var px=0; px<=W; px+=step){
      var t = (px/W)*periods + phase;
      var y = mid - beat(t)*amp;
      if(px===0) ctx.moveTo(px,y); else ctx.lineTo(px,y);
    }
    ctx.stroke();
    // faint baseline
    ctx.globalAlpha=0.15; ctx.lineWidth=1; ctx.beginPath();
    ctx.moveTo(0,mid); ctx.lineTo(W,mid); ctx.stroke(); ctx.globalAlpha=1;
    if(!reduce){ phase += 0.0016; requestAnimationFrame(draw); }
  }
  draw();
})();
`;
