const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const date = process.argv[2] || new Date().toISOString().slice(0, 10);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

async function main() {
  const newsData = readJson(path.join(ROOT, "data", "news", `${date}.json`));
  const dailyData = readJson(path.join(ROOT, "data", "daily", `${date}.json`));

  if (!newsData || !newsData.items || !newsData.items.length) {
    console.log("No hay datos de noticias para " + date + ", no se genera tarjeta.");
    process.exit(0);
  }

  const items = newsData.items.slice(0, 3);
  const tip = (dailyData && dailyData.tips && dailyData.tips[0]) || null;

  const newsHtml = items
    .map(
      (it, i) => `
      <div class="news-box">
        <div class="news-index">${i + 1}</div>
        <div class="news-box-body">
          <span class="tag">${escapeHtml(it.tag || "")}</span>
          <div class="news-title">${escapeHtml(it.title || "")}</div>
        </div>
      </div>`
    )
    .join("\n");

  const tipText = tip ? escapeHtml(tip.text) : "Vuelve cada dia para un tip nuevo.";

  const logoPath = path.join(ROOT, "pilapila.png");
  const logoB64 = fs.readFileSync(logoPath).toString("base64");
  const logoSrc = `data:image/png;base64,${logoB64}`;

  const mascotPath = path.join(ROOT, "pila-pila-senalando.png");
  const mascotB64 = fs.readFileSync(mascotPath).toString("base64");
  const mascotSrc = `data:image/png;base64,${mascotB64}`;

  const fmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  let dateline;
  try {
    const parts = date.split("-").map(Number);
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    dateline = fmt.format(d);
    dateline = dateline.charAt(0).toUpperCase() + dateline.slice(1);
  } catch (e) {
    dateline = date;
  }

  let template = fs.readFileSync(path.join(__dirname, "template.html"), "utf8");
  template = template
    .split("__LOGO_SRC__").join(logoSrc)
    .split("__MASCOT_SRC__").join(mascotSrc)
    .replace("__DATELINE__", dateline)
    .replace("__NEWS_ITEMS__", newsHtml)
    .replace("__TIP_TEXT__", tipText);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(template, { waitUntil: "networkidle" });
  const outPath = path.join(ROOT, "render", "card.png");
  await page.screenshot({ path: outPath });
  await browser.close();
  console.log("Tarjeta generada en " + outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
