// Gemeinsame Hilfsfunktionen für alle Seiten der Börse-App (Demo-/Spiel-Tracker, kein echtes Geld)

const DATA_PATHS = {
  settings: "data/settings.json",
  portfolio: "data/portfolio.json",
  log: "data/log.json",
  gepvolt: "data/gepvolt.json",
  capital: "data/capital.json",
};

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Konnte ${path} nicht laden (${res.status})`);
  return res.json();
}

function fmtEur(n) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

function fmtPct(n) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)} %`;
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function deltaClass(n) {
  if (n > 0) return "positive";
  if (n < 0) return "negative";
  return "neutral";
}

function computePortfolioTotals(positions) {
  const open = positions.filter(p => p.status === "open");
  const closed = positions.filter(p => p.status === "closed");
  const currentValue = open.reduce((sum, p) => sum + (p.currentValue ?? p.amount), 0);
  const invested = open.reduce((sum, p) => sum + p.amount, 0);
  const profitLoss = currentValue - invested;
  const profitLossPct = invested > 0 ? (profitLoss / invested) * 100 : 0;
  const realizedPL = closed.reduce((sum, p) => sum + (p.profitLoss ?? 0), 0);
  return { open, closed, currentValue, invested, profitLoss, profitLossPct, realizedPL };
}

// Kapitalregeln: Realisierte Gewinne wandern in einen gesperrten Topf und werden nie wieder
// investiert; realisierte Verluste mindern das frei verfuegbare Neugeld.
function computeCapital(positions, capital) {
  const open = positions.filter(p => p.status === "open");
  const closed = positions.filter(p => p.status === "closed");

  const invested = positions.reduce((sum, p) => sum + p.amount, 0);
  const returned = closed.reduce((sum, p) => sum + p.amount + Math.min(p.profitLoss ?? 0, 0), 0);
  const profitPot = closed.reduce((sum, p) => sum + Math.max(p.profitLoss ?? 0, 0), 0);
  const realizedLosses = closed.reduce((sum, p) => sum + Math.min(p.profitLoss ?? 0, 0), 0);

  const freeCash = (capital?.totalFreshCapitalEur ?? 0) - invested + returned;
  const depot = open.reduce((sum, p) => sum + (p.currentValue ?? p.amount), 0);

  return { freeCash, profitPot, realizedLosses, depot, total: freeCash + depot + profitPot };
}

// Flacht die stuendlichen updates aller Tage zu einer Intraday-Reihe fuer den Chart ab.
function buildChartSeries(log, fallbackValue) {
  const sorted = [...log].sort((a, b) => a.date.localeCompare(b.date));
  const series = [];
  for (const entry of sorted) {
    if (Array.isArray(entry.updates) && entry.updates.length) {
      for (const u of entry.updates) {
        if (typeof u.portfolioValue === "number") series.push(u.portfolioValue);
      }
    } else if (typeof entry.portfolioValueEnd === "number") {
      series.push(entry.portfolioValueEnd);
    }
  }
  if (series.length === 0) return [fallbackValue, fallbackValue];
  if (series.length === 1) return [series[0], series[0]];
  return series;
}

function renderBottomNav(active) {
  const items = [
    { href: "index.html", icon: "\u{1F4CA}", label: "Dashboard", key: "dashboard" },
    { href: "portfolio.html", icon: "\u{1F4BC}", label: "Portfolio", key: "portfolio" },
    { href: "log.html", icon: "\u{1F4D6}", label: "Tages-Log", key: "log" },
    { href: "gepvolt.html", icon: "\u{1F50B}", label: "GEPVOLT SE", key: "gepvolt" },
    { href: "settings.html", icon: "\u{2699}", label: "Einstellungen", key: "settings" },
  ];
  const nav = document.createElement("nav");
  nav.className = "bottom-nav";
  nav.innerHTML = items.map(i =>
    `<a href="${i.href}" class="${i.key === active ? "active" : ""}">
       <span class="icon">${i.icon}</span><span>${i.label}</span>
     </a>`
  ).join("");
  document.body.appendChild(nav);
}

function showToast(msg) {
  let toast = document.querySelector(".save-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "save-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

// Einfacher, abhängigkeitsfreier Linien-Chart für den Portfolio-Verlauf
function drawLineChart(canvas, values, labels) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);

  if (values.length < 2) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-dim");
    ctx.font = "12px sans-serif";
    ctx.fillText("Noch nicht genug Verlaufsdaten", 4, h / 2);
    return;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 8;
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (values.length - 1);

  const first = values[0];
  const last = values[values.length - 1];
  const styles = getComputedStyle(document.documentElement);
  const lineColor = last >= first ? styles.getPropertyValue("--green") : styles.getPropertyValue("--red");

  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = lineColor.trim();
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Fläche unter der Linie
  ctx.lineTo(pad + (values.length - 1) * stepX, h - pad);
  ctx.lineTo(pad, h - pad);
  ctx.closePath();
  ctx.fillStyle = lineColor.trim() + "22";
  ctx.fill();
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
}
