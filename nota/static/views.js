import { icon, esc, money, num, dateFmt, shift, today, amount, receipt, categoryIcon, longDate, chart } from "./ui.js";

export function period(data, days) {
  const last = data.sales.reduce((d, s) => (s.date > d ? s.date : d), "") || today(),
    start = shift(last, 1 - days),
    prev = shift(start, -days);
  const now = data.sales.filter((s) => s.date >= start),
    before = data.sales.filter((s) => s.date >= prev && s.date < start);
  const totals = new Map();
  for (const s of now) totals.set(s.date, (totals.get(s.date) || 0) + amount(s));
  const points = Array.from({ length: days }, (_, i) => {
    const date = shift(start, i);
    return { date, amount: totals.get(date) || 0 };
  });
  return { start, last, now, before, points, hasHistory: data.sales.some((s) => s.date <= prev) };
}
function measures(sales) {
  return [sales.reduce((v, s) => v + amount(s), 0), sales.length, sales.reduce((v, s) => v + s.items.reduce((a, i) => a + i.qty, 0), 0)];
}
function spark(points) {
  const max = Math.max(1, ...points.map((p) => p.amount));
  const line = points.map((p, i) => (i * 120) / (points.length - 1) + "," + (36 - (p.amount * 32) / max)).join(" ");
  return '<svg aria-hidden="true" class="spark" viewBox="0 0 120 40"><polyline points="' + line + '" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function metrics(p, days) {
  const current = measures(p.now),
    before = measures(p.before);
  const names = ["Total omzet", "Jumlah transaksi", "Produk terjual"],
    icons = ["wallet", "receipt", "box"];
  return (
    '<div class="metrics">' +
    names
      .map((n, i) => {
        const diff = p.hasHistory && before[i] ? ((current[i] - before[i]) * 100) / before[i] : null;
        const badge = diff === null ? "Pembanding belum cukup" : '<b class="delta ' + (diff < 0 ? "down" : "") + '">' + (diff > 0 ? "+" : "") + num(Math.round(diff * 10) / 10) + "%</b> vs " + days + " hari lalu";
        return (
          '<article class="metric m' +
          i +
          '"><div class="metric-line"><span class="meticon">' +
          icon(icons[i]) +
          "</span>" +
          n +
          "</div><strong>" +
          (i === 0 ? money(current[i]) : num(current[i])) +
          '</strong><div class="metric-sub">' +
          badge +
          "</div>" +
          (i === 0 ? spark(p.points) : "") +
          "</article>"
        );
      })
      .join("") +
    "</div>"
  );
}
function table(sales, products) {
  if (!sales.length) return '<p class="empty">Tidak ada transaksi yang cocok.</p>';
  return (
    '<div class="scroll"><table><thead><tr><th>No. nota</th><th>Tanggal</th><th>Produk</th><th>Pembayaran</th><th class="right">Total</th></tr></thead><tbody>' +
    sales
      .map((s) => {
        const item = s.items[0],
          more = s.items.length - 1;
        return (
          '<tr><td><button class="link" data-sale="' +
          s.id +
          '">' +
          receipt(s.id) +
          "</button></td><td>" +
          dateFmt(s.date, { day: "numeric", month: "short", year: "numeric" }) +
          "</td><td>" +
          esc(products[item.product].name) +
          (more ? " <small>+" + more + "</small>" : "") +
          "</td><td>" +
          esc(s.payment) +
          '</td><td class="right"><b>' +
          money(amount(s)) +
          "</b></td></tr>"
        );
      })
      .join("") +
    "</tbody></table></div>"
  );
}
const sorted = (rows) => [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
export function dashboard(data, products, days, byCategory) {
  const p = period(data, days),
    units = new Map();
  for (const s of p.now)
    for (const i of s.items) {
      const key = byCategory ? products[i.product].category : i.product;
      units.set(key, (units.get(key) || 0) + i.qty);
    }
  const ranked = [...units].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  const ranking = ranked
    .map(([key, qty], i) => {
      const cat = byCategory ? key : products[key].category;
      return (
        '<li><span class="product-icon c' +
        i +
        '">' +
        icon(categoryIcon[cat]) +
        '</span><div><div class="rank-name"><b>' +
        esc(byCategory ? key : products[key].name) +
        "</b><span>" +
        num(qty) +
        '</span></div><div class="track"><i style="width:' +
        Math.round((qty * 100) / ranked[0][1]) +
        '%"></i></div></div></li>'
      );
    })
    .join("");
  return (
    '<div class="period"><span>' +
    icon("calendar") +
    longDate(p.start) +
    " – " +
    longDate(p.last) +
    '</span><div class="segments" aria-label="Periode ringkasan">' +
    [7, 30, 90].map((v) => '<button data-days="' + v + '" aria-pressed="' + (days === v) + '">' + v + " hari</button>").join("") +
    "</div></div>" +
    metrics(p, days) +
    '<div class="charts"><article class="panel trend"><header><div><h2>Tren omzet</h2><p>Penjualan harian dalam rupiah</p></div><span class="legend"><i></i>Omzet</span></header>' +
    chart(p.points, "Tren omzet harian selama " + days + " hari") +
    "</article>" +
    '<article class="panel"><header><div><h2>Penjualan terlaris</h2><p>Peringkat menurut jumlah unit</p></div><select aria-label="Kelompok peringkat" id="rankby"><option value="product">Produk</option><option value="category" ' +
    (byCategory ? "selected" : "") +
    '>Kategori</option></select></header><ol class="ranking">' +
    ranking +
    "</ol>" +
    (!ranking ? '<p class="empty">Belum ada penjualan.</p>' : "") +
    "</article></div>" +
    '<article class="panel list"><header><div><h2>Transaksi terbaru</h2><p>Lima nota terakhir dalam periode terpilih</p></div><a href="#transaksi" class="textlink">Lihat semua</a></header>' +
    table(sorted(p.now).slice(0, 5), products) +
    "</article>"
  );
}

export function ledger(data, products, query, page) {
  const search = query.trim().toLocaleLowerCase("id");
  const rows = sorted(data.sales.filter((s) => [receipt(s.id), s.date, s.payment, ...s.items.map((i) => products[i.product].name)].join(" ").toLocaleLowerCase("id").includes(search)));
  const pages = Math.max(1, Math.ceil(rows.length / 12)),
    n = Math.min(page, pages);
  return (
    '<article class="panel list"><header><div><h2>Daftar transaksi</h2><p>' +
    num(rows.length) +
    ' nota ditemukan</p></div><label class="search">' +
    icon("search") +
    '<input id="search" aria-label="Cari nota, produk, tanggal, atau pembayaran" placeholder="Cari nota atau produk…" value="' +
    esc(query) +
    '"></label></header>' +
    table(rows.slice((n - 1) * 12, n * 12), products) +
    '<div class="pager"><span>Halaman ' +
    n +
    " dari " +
    pages +
    '</span><div><button data-page="' +
    (n - 1) +
    '" ' +
    (n === 1 ? "disabled" : "") +
    '>Sebelumnya</button><button data-page="' +
    (n + 1) +
    '" ' +
    (n === pages ? "disabled" : "") +
    ">Berikutnya</button></div></div></article>"
  );
}
export function prediction(f, horizon = 7, page = 1) {
  if (!f) return '<article class="panel"><h2>Riwayat belum cukup</h2><p>Prediksi memerlukan minimal 35 hari kalender sejak transaksi pertama hingga terakhir.</p></article>';
  const selected = f.future.slice(0, horizon);
  const total = selected.reduce((sum, day) => sum + day.amount, 0);

  const pageSize = 7;
  const pageCount = Math.ceil(selected.length / pageSize);
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = (currentPage - 1) * pageSize;
  const visible = selected.slice(start, start + pageSize);

  const rows = visible
    .map(
      (day) => `
    <tr>
      <td>${longDate(day.date)}</td>
      <td class="right">${money(day.amount)}</td>
    </tr>
  `,
    )
    .join("");

  const periodPicker = `
    <label>
      Periode prediksi
      <select id="forecast-horizon">
        ${[7, 14, 30]
          .map(
            (days) => `
          <option value="${days}" ${days === horizon ? "selected" : ""}>
            ${days} hari ke depan
          </option>
        `,
          )
          .join("")}
      </select>
    </label>
  `;

  const pager = `
    <div class="pager">
      <span>Hari ${start + 1}–${start + visible.length} dari ${selected.length}</span>
      <div>
        <button data-forecast-page="${currentPage - 1}"
                ${currentPage === 1 ? "disabled" : ""}>Sebelumnya</button>
        <button data-forecast-page="${currentPage + 1}"
                ${currentPage === pageCount ? "disabled" : ""}>Berikutnya</button>
      </div>
    </div>
  `;
  return (
    '<div class="period"><span>' +
    icon("calendar") +
    longDate(selected[0].date) +
    " – " +
    longDate(selected.at(-1).date) 	+'</span>'+periodPicker+'</div><div class="metrics">' +
    [
      ["Estimasi omzet '+horizon+' hari", total, "Hasil prediksi model", "wallet"],
      ["MAE model", f.mae, "Rata-rata galat per hari uji", "chart"],
      ["MAE pembanding", f.baseline, "Acuan omzet hari yang sama pekan lalu", "calendar"],
    ]
      .map(
        ([title, value, hint, symbol], i) =>
          '<article class="metric m' + i + '"><div class="metric-line"><span class="meticon">' + icon(symbol) + "</span>" + title + "</div><strong>" + money(value) + '</strong><div class="metric-sub">' + hint + "</div></article>",
      )
      .join("") +
    "</div>" +
    '<div class="charts"><article class="panel"><header><div><h2>Prediksi omzet harian</h2><p>'+horizon+' hari setelah transaksi terakhir</p></div></header>' +
    chart(f.future, "Prediksi omzet "+horizon+" hari ke depan") +
    '</article><article class="panel method"><h2>Evaluasi model</h2><p>Regresi linear mempelajari tren waktu dan pola hari dalam minggu.</p><p>Pelatihan memakai ' +
    (f.days - 7) +
    " hari awal. "+horizon+" hari terakhir (" +
    dateFmt(f.testStart) +
    "–" +
    dateFmt(f.end) +
    ") disisihkan untuk pengujian.</p><p><b>" +
    (f.mae < f.baseline ? "Galat model lebih kecil dari acuan." : f.mae > f.baseline ? "Acuan mingguan lebih akurat pada periode uji." : "Galat model dan acuan sama pada periode uji.") +
    "</b> MAE menyatakan rata-rata selisih absolut dalam rupiah.</p></article></div>" +
    '<article class="panel list"><header><div><h2>Rincian prediksi</h2><p>Model dilatih ulang dengan ' +
    f.days +
    ' hari untuk menghasilkan estimasi ini.</p></div></header><table><thead><tr><th>Tanggal</th><th class="right">Estimasi omzet</th></tr></thead><tbody>' +rows+'</tbody></table>'+pager+'</article>'
  );
}
