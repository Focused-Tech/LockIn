// CDP driver: node cdp-drive.mjs "<ws>" "<action>"
//   actions: "buttons" | "url" | "click:TEXT"
const ws = process.argv[2];
const action = process.argv[3];
let expr;
if (action === "buttons") {
  expr = `JSON.stringify([...document.querySelectorAll('button,a,[role=button]')].map(b => (b.textContent||'').trim().replace(/\\s+/g,' ').slice(0,44)).filter(Boolean))`;
} else if (action === "url") {
  expr = `location.pathname`;
} else if (action.startsWith("click:")) {
  const t = action.slice(6).replace(/'/g, "\\'").toLowerCase();
  expr = `(() => { const t='${t}'; const el=[...document.querySelectorAll('button,a,[role=button]')].find(b => (b.textContent||'').toLowerCase().includes(t)); if(!el) return 'NOT FOUND: '+t; el.click(); return 'clicked: '+(el.textContent||'').trim().slice(0,40); })()`;
} else {
  expr = action;
}
const sock = new WebSocket(ws);
sock.onopen = () => sock.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true } }));
sock.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id === 1) { console.log(m.result?.result?.value ?? JSON.stringify(m.error)); sock.close(); process.exit(0); }
};
sock.onerror = (e) => { console.error("WS err", e.message || e); process.exit(1); };
setTimeout(() => { console.error("timeout"); process.exit(1); }, 9000);
