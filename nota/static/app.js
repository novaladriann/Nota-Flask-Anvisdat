import { load, persist } from "./source.js";
import { icon, esc, money, today, longDate, amount, receipt } from "./ui.js";
import { dashboard, ledger, prediction } from "./views.js";
const $ = (s) => document.querySelector(s),
  content = $("#content"),
  dialog = $("#dialog"),
  body = $("#dialog-body");
const pages = {
  ringkasan: ["Ringkasan", "Ringkasan penjualan", "Pantau omzet, transaksi, dan produk terlaris Toko Aksara."],
  transaksi: ["Transaksi", "Transaksi penjualan", "Telusuri nota dan kelola pencatatan penjualan toko."],
  prediksi: ["Pilih periode untuk melihat estimasi omzet berdasarkan riwayat transaksi."],
};
let data,
  products,
  days = 30,
  byCategory = false,
  query = "",
  page = 1,
  editing = null,
  draft = null,
  busy = false;
let forecastHorizon = 7;
let forecastPage = 1;
document.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
function notice(msg) {
  const box = $("#notice");
  box.textContent = msg;
  box.hidden = !msg;
}
function render() {
  const key = Object.hasOwn(pages, location.hash.slice(1)) ? location.hash.slice(1) : "ringkasan";
  const [label, title, summary] = pages[key];
  document.title = label + " · Nota";
  $("#crumb").textContent = label;
  $("#heading").textContent = title;
  $("#subtitle").textContent = summary;
  document.querySelectorAll("nav a").forEach((a) => {
    if (a.dataset.view === key) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (!data) return;
  content.innerHTML = key === "ringkasan" ? dashboard(data, products, days, byCategory) : key === "transaksi" ? ledger(data, products, query, page) : prediction(data.forecast, forecastHorizon, forecastPage);
}
async function refresh() {
  data = await load();
  products = Object.fromEntries(data.products.map((p) => [p.code, p]));
  render();
}
function modal(title, html) {
  body.innerHTML = '<header class="dlg-head"><h2 id="dlg-title" tabindex="-1">' + title + '</h2><button class="iconbtn" aria-label="Tutup" data-close>' + icon("close") + "</button></header>" + html;
  if (!dialog.open) dialog.showModal();
  $("#dlg-title").focus();
}
function showSale(id) {
  editing = data.sales.find((s) => s.id === id);
  if (!editing) return;
  const s = editing;
  modal(
    "Nota " + receipt(s.id),
    '<p class="detail-meta">' +
      longDate(s.date) +
      " <span>·</span> " +
      esc(s.payment) +
      '</p><div class="detail-lines">' +
      s.items.map((i) => "<div><span><b>" + esc(products[i.product].name) + "</b><small>" + i.qty + " × " + money(i.price) + "</small></span><b>" + money(i.qty * i.price) + "</b></div>").join("") +
      '</div><div class="form-total"><span>Total transaksi</span><b>' +
      money(amount(s)) +
      '</b></div><div class="dlg-actions"><button class="danger-link" id="ask-delete">Hapus nota</button><button class="primary" id="edit">Ubah transaksi</button></div>',
  );
}
function initialForm(s) {
  editing = s;
  draft = s ? structuredClone(s) : { date: today(), payment: "Tunai", items: [{ product: data.products[0].code, qty: 1 }] };
  const line = (i) =>
    '<div class="item-row"><label>Produk<select class="product">' +
    data.products.map((p) => '<option value="' + p.code + '" ' + (i.product === p.code ? "selected" : "") + ">" + esc(p.name) + "</option>").join("") +
    '</select></label><label>Jumlah<input class="quantity" type="number" min="1" max="999" step="1" value="' +
    i.qty +
    '" required></label><button type="button" class="iconbtn remove" aria-label="Hapus baris produk">' +
    icon("trash") +
    "</button></div>";
  modal(
    s ? "Ubah " + receipt(s.id) : "Catat transaksi",
    '<form id="sale-form"><div class="fields"><label>Tanggal<input type="date" id="date" value="' +
      draft.date +
      '" min="2000-01-01" max="' +
      today() +
      '" required></label><label>Pembayaran<select id="payment">' +
      ["Tunai", "QRIS", "Debit"].map((m) => "<option " + (m === draft.payment ? "selected" : "") + ">" + m + "</option>").join("") +
      '</select></label></div><div id="items">' +
      draft.items.map(line).join("") +
      '</div><button type="button" class="textlink" id="add-item">+ Tambah produk</button><div class="form-total"><span>Total transaksi</span><b id="sum"></b></div><p role="alert" id="error" hidden></p><div class="dlg-actions"><button type="button" data-close>Batal</button><button class="primary">Simpan transaksi</button></div></form>',
  );
  function read() {
    draft.date = $("#date").value;
    draft.payment = $("#payment").value;
    draft.items = [...body.querySelectorAll(".item-row")].map((el) => ({ product: el.querySelector("select").value, qty: Number(el.querySelector("input").value) }));
    $("#sum").textContent = money(draft.items.reduce((a, i) => a + i.qty * (editing?.items.find((o) => o.product === i.product)?.price ?? products[i.product].price), 0));
    body.querySelectorAll(".remove").forEach((b) => (b.disabled = draft.items.length === 1));
    $("#add-item").disabled = draft.items.length >= data.products.length;
  }
  read();
  $("#sale-form").oninput = () => {
    read();
    $("#error").hidden = true;
  };
  $("#add-item").onclick = () => {
    const next = data.products.find((p) => !draft.items.some((i) => i.product === p.code));
    if (next) {
      $("#items").insertAdjacentHTML("beforeend", line({ product: next.code, qty: 1 }));
      read();
      $("#items").lastElementChild.querySelector("select").focus();
    }
  };
  $("#items").onclick = (e) => {
    const b = e.target.closest(".remove");
    if (b) {
      b.closest(".item-row").remove();
      read();
      $("#add-item").focus();
    }
  };
  $("#sale-form").onsubmit = (e) => {
    e.preventDefault();
    read();
    if (new Set(draft.items.map((i) => i.product)).size !== draft.items.length) {
      showError("Produk yang sama cukup ditulis sekali. Ubah jumlahnya pada satu baris.");
      return;
    }
    mutate(s ? "PUT" : "POST", draft, s?.id);
  };
}
function showError(msg) {
  const p = $("#error");
  p.hidden = false;
  p.textContent = msg;
}
async function mutate(method, payload, id) {
  if (busy) return;
  busy = true;
  const controls = [...body.querySelectorAll("button,input,select")].filter((el) => !el.disabled);
  controls.forEach((el) => (el.disabled = true));
  let saved = false;
  try {
    const key = await persist(method, payload, id);
    saved = true;
    dialog.close();
    await refresh();
    notice("Nota " + receipt(key) + (method === "DELETE" ? " berhasil dihapus." : " tersimpan."));
  } catch (e) {
    if (saved) notice("Perubahan tersimpan. Muat ulang halaman untuk memperbarui data.");
    else showError(e.message);
  } finally {
    busy = false;
    controls.forEach((el) => (el.disabled = false));
  }
}
dialog.addEventListener("cancel", (e) => {
  if (busy) e.preventDefault();
});
body.onclick = (e) => {
  if (e.target.closest("[data-close]")) dialog.close();
  if (e.target.closest("#edit")) initialForm(editing);
  if (e.target.closest("#ask-delete"))
    modal(
      "Hapus " + receipt(editing.id) + "?",
      "<p>Nota senilai " +
        money(amount(editing)) +
        ' akan dihapus. Ringkasan dan prediksi akan dihitung ulang.</p><p role="alert" id="error" hidden></p><div class="dlg-actions"><button id="keep">Kembali</button><button id="confirm-delete" class="danger">Hapus nota</button></div>',
    );
  if (e.target.closest("#keep")) showSale(editing.id);
  if (e.target.closest("#confirm-delete")) mutate("DELETE", { version: editing.version }, editing.id);
};
$("#add").onclick = () => {
  if (data) initialForm(null);
};
content.onclick = (e) => {
  const el = e.target.closest("button");
  if (!el) return;
  if (el.dataset.days) {
    days = Number(el.dataset.days);
    render();
    content.querySelector('[data-days="' + days + '"]').focus();
  }
  if (el.dataset.page) {
    page = Number(el.dataset.page);
    render();
    $("#search").focus();
  }
  if (el.dataset.sale) showSale(Number(el.dataset.sale));
};
content.onchange = (e) => {
  if (e.target.id === "rankby") {
    byCategory = e.target.value === "category";
    render();
    $("#rankby").focus();
  }
};
content.oninput = (e) => {
  if (e.target.id === "search") {
    const pos = e.target.selectionStart;
    query = e.target.value;
    page = 1;
    render();
    $("#search").focus();
    $("#search").setSelectionRange(pos, pos);
  }
};

content.addEventListener('change', event => {
  if (event.target.id !== 'forecast-horizon') return;

  forecastHorizon = Number(event.target.value);
  forecastPage = 1;
  render();
  document.querySelector('#forecast-horizon').focus();
});

content.addEventListener('click', event => {
  const button = event.target.closest('button[data-forecast-page]');
  if (!button) return;

  forecastPage = Number(button.dataset.forecastPage);
  render();

  const pager = content.querySelector('.pager');
  const nextFocus = pager?.querySelector(
    `button[data-forecast-page="${forecastPage + 1}"]:enabled`
  ) || pager?.querySelector('button:enabled');
  nextFocus?.focus();
});

window.onhashchange = () => {
  notice("");
  render();
  $("#main").focus();
};
render();
$("#add").disabled = true;
refresh()
  .then(() => ($("#add").disabled = false))
  .catch(() => notice("Tidak dapat memuat data. Pastikan penyimpanan browser diizinkan, lalu muat ulang halaman."));
