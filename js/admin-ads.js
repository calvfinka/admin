/* Panel Admin > Iklan & Lencana: pasang lencana iklan di gowithdme.com.
   Data hanya lewat RPC admin_list_ads / admin_save_ad / admin_toggle_ad / admin_delete_ad (supabase/schema_iklan.sql di repo situs).
   Katalog tempat, validasi, dan pratinjau memakai js/ads-core.js yang sama dengan situs, jadi pratinjau = tampilan asli.
   Izin: sponsor.view (melihat), sponsor.manage (mengubah) - tidak ada izin baru. */
(function () {
  var box = document.getElementById("v_iklan"), A = window.IB_AdsCore;
  if (!box || !window.sb || !A) return;
  var $ = function (i) { return document.getElementById(i); };
  var STATUS = { live: "Tayang", scheduled: "Terjadwal", ended: "Berakhir", off: "Nonaktif" };
  var SITE = "https://gowithdme.com/";
  var VISIT = { home_rail: "id/", home_top: "id/", event_list: "id/event", event_detail: "id/event", blog_post: "blog/" };
  var LEAD_SLOT = { national_portal: "home_rail", city_spotlight: "home_top", free: "event_list" };
  var LEAD_W = { national_portal: 9, city_spotlight: 7, free: 4 };
  var MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  var rows = [], loaded = false, loading = false, failed = "", fSlot = "", fSt = "", editing = null;

  function esc(s) { return A.esc(s); }
  function fd(iso) { if (!iso) return ""; var d = new Date(String(iso).slice(0, 10) + "T00:00:00"); return d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear(); }
  function addDays(iso, n) { var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function canEdit() { return !!(window.RBAC && window.IB_ADMIN && RBAC.can(window.IB_ADMIN, "sponsor.manage")); }
  function pin(key) { for (var i = 0; i < A.SLOTS.length; i++) if (A.SLOTS[i].key === key) return i + 1; return 0; }
  function stOf(r) { return A.statusOf(r, A.todayWIB()); }
  function counts(key) {
    var c = { live: 0, all: 0 };
    rows.forEach(function (r) { if (r.slot === key) { c.all++; if (stOf(r) === "live") c.live++; } });
    return c;
  }

  /* ---------- peta penempatan: denah sederhana halaman situs, kotak bernomor bisa diketuk ---------- */
  function zone(key, cls) {
    var s = A.slot(key), c = counts(key), on = fSlot === key;
    return '<button type="button" class="wf-z ' + cls + (on ? " on" : "") + '" data-slot="' + key + '" aria-pressed="' + on + '" aria-label="Tempat ' + pin(key) + ": " + esc(s.page + ", " + s.name) + ". " + c.live + ' tayang">' +
      "<i>" + pin(key) + "</i><span>" + esc(s.name) + "</span><b" + (c.live ? "" : ' class="e"') + ">" + (c.live ? c.live + " tayang" : "kosong") + "</b></button>";
  }
  function wf(title, body) {
    return '<figure class="wf"><div class="wf-bar"><i></i><i></i><i></i></div><div class="wf-body">' + body + "</div><figcaption>" + esc(title) + "</figcaption></figure>";
  }
  function mapHtml() {
    var tiles = function (n) { var h = ""; for (var i = 0; i < n; i++) h += "<i></i>"; return '<div class="wf-tiles">' + h + "</div>"; };
    var home = '<div class="wf-cols"><div class="wf-main"><div class="wf-b s"></div><div class="wf-b"></div>' + zone("home_top", "strip") +
      '<div class="wf-tabs"><i></i><i></i><i></i></div>' + tiles(3) + '</div><div class="wf-side"><div class="wf-b"></div><div class="wf-b"></div>' + zone("home_rail", "card") + '<div class="wf-b"></div></div></div>';
    var ev = '<div class="wf-line w60 t"></div><div class="wf-tabs"><i></i><i></i><i></i></div>' + zone("event_list", "strip") + tiles(4);
    var dt = '<div class="wf-dlg"><div class="wf-poster"></div><div class="wf-info"><div class="wf-line w80 t"></div><div class="wf-line"></div><div class="wf-line w60"></div><div class="wf-btns"><i></i><i></i><i></i></div>' +
      zone("event_detail", "card") + '<div class="wf-line w40"></div></div></div>';
    var bl = '<div class="wf-line w80 t"></div><div class="wf-line"></div><div class="wf-line"></div><div class="wf-line w60"></div>' + zone("blog_post", "strip") + '<div class="wf-line w40"></div><div class="wf-cm"></div>';
    return '<div class="wf-grid">' + wf("Beranda", home) + wf("Halaman Event & Gunung", ev) + wf("Detail event (jendela)", dt) + wf("Artikel blog", bl) + "</div>";
  }
  function slotInfo() {
    if (!fSlot) return '<p class="meta">Ketuk kotak bernomor pada peta untuk melihat penjelasan tempatnya dan menambah lencana di sana.</p>';
    var s = A.slot(fSlot), c = counts(fSlot);
    return '<div class="ad-si"><div><b>' + pin(fSlot) + ". " + esc(s.page) + " · " + esc(s.name) + '</b><p class="meta">' + esc(s.desc) + '</p><p class="meta">Bentuk: ' + (s.fmt === "card" ? "kartu" : "baris tipis") + " · " + c.live + " tayang, " + c.all + " tercatat · " +
      '<a href="' + SITE + VISIT[fSlot] + '" target="_blank" rel="noopener noreferrer">Lihat di situs</a></p></div><div class="row"><button class="btn pri sm adm-ad-edit" type="button" data-adnew="' + fSlot + '">+ Lencana di sini</button><button class="btn ghost sm" type="button" data-slot="">Tampilkan semua</button></div></div>';
  }

  /* ---------- daftar ---------- */
  function stats() {
    var live = 0, sch = 0, clk = 0;
    rows.forEach(function (r) { var s = stOf(r); if (s === "live") live++; if (s === "scheduled") sch++; clk += Number(r.clicks) || 0; });
    var t = [["Tayang sekarang", live, "di situs saat ini"], ["Terjadwal", sch, "belum mulai"], ["Total klik", clk, "sejak dibuat (indikatif)"]];
    return '<div class="sp-stats ad-stats">' + t.map(function (x) { return '<div class="sp-stat"><span>' + esc(x[0]) + "</span><b>" + esc(x[1]) + "</b><small>" + esc(x[2]) + "</small></div>"; }).join("") + "</div>";
  }
  function card(r) {
    var s = A.slot(r.slot) || { page: r.slot, name: "", fmt: "card" }, st = stOf(r);
    var chips = ["Tempat " + pin(r.slot) + ": " + s.page + " · " + s.name, r.city ? "Kota: " + r.city : "Semua kota",
      (r.starts_on || r.ends_on) ? (r.starts_on ? fd(r.starts_on) : "sekarang") + " → " + (r.ends_on ? fd(r.ends_on) : "tanpa batas") : "Tanpa batas waktu",
      "Bobot " + r.weight, (Number(r.clicks) || 0) + " klik"].map(function (c) { return '<span class="sp-chip">' + esc(c) + "</span>"; }).join("");
    return '<article class="sp-card ad-card' + (st === "live" ? " live" : "") + '" data-id="' + esc(r.id) + '">' +
      '<div class="sp-hd"><div><h3>' + esc(r.title) + "</h3></div>" + '<span class="badge' + (st === "live" ? " pub" : st === "scheduled" ? " adm" : "") + '">' + STATUS[st] + "</span></div>" +
      '<div class="ad-pv" aria-hidden="true">' + A.badgeHtml(r, { fmt: s.fmt, lang: "id" }) + "</div>" +
      '<div class="sp-chips">' + chips + "</div>" +
      '<div class="sp-ft adm-ad-edit"><small>Diubah ' + esc(fd(r.updated_at)) + '</small><span class="row"><button class="btn sm" type="button" data-adedit="' + esc(r.id) + '">Ubah</button>' +
      '<button class="btn sm" type="button" data-adtog="' + esc(r.id) + '">' + (r.active ? "Nonaktifkan" : "Aktifkan") + '</button><button class="btn ghost sm" type="button" data-addel="' + esc(r.id) + '">Hapus</button></span></div></article>';
  }
  function draw() {
    var m = $("adMap"); if (m) m.innerHTML = failed ? "" : mapHtml();
    var si = $("adSlotInfo"); if (si) si.innerHTML = failed ? "" : slotInfo();
    var stt = $("adStats"); if (stt) stt.innerHTML = failed ? "" : stats();
    var tabs = $("adTabs");
    if (tabs) tabs.innerHTML = [["", "Semua"]].concat(Object.keys(STATUS).map(function (k) { return [k, STATUS[k]]; })).map(function (t) {
      var n = rows.filter(function (r) { return (!fSlot || r.slot === fSlot) && (!t[0] || stOf(r) === t[0]); }).length;
      return '<button class="tab' + (fSt === t[0] ? " on" : "") + '" data-adst="' + t[0] + '" type="button">' + t[1] + " <small>" + n + "</small></button>";
    }).join("");
    var list = $("adList"); if (!list) return;
    if (failed) { list.innerHTML = '<div class="empty">' + esc(failed) + "</div>"; return; }
    var l = rows.filter(function (r) { return (!fSlot || r.slot === fSlot) && (!fSt || stOf(r) === fSt); });
    list.innerHTML = l.length ? l.map(card).join("") : '<div class="empty">' + (rows.length ? "Tidak ada lencana yang cocok dengan filter." : "Belum ada lencana. Ketuk kotak bernomor di peta, lalu \"+ Lencana di sini\".") + "</div>";
  }
  function load(force) {
    if (loading || (loaded && !force)) return;
    loading = true;
    var list = $("adList"); if (list && !rows.length) list.innerHTML = '<div class="empty">Memuat…</div>';
    Promise.resolve(sb.rpc("admin_list_ads")).then(function (r) {
      loading = false;
      if (r.error) {
        failed = /admin_list_ads|PGRST202|42883/i.test((r.error.message || "") + (r.error.code || ""))
          ? "Fungsi iklan belum ada di database. Jalankan supabase/schema_iklan.sql (repo situs) di SQL Editor Supabase, lalu muat ulang."
          : friendlyErr(r.error);
        draw(); return;
      }
      failed = ""; loaded = true; rows = r.data || []; draw();
    }, function (err) { loading = false; failed = friendlyErr(err); draw(); });
  }

  /* ---------- formulir ---------- */
  function fillStatic() {
    $("adSlot").innerHTML = A.SLOTS.map(function (s, i) { return '<option value="' + s.key + '">' + (i + 1) + ". " + esc(s.page + " · " + s.name) + "</option>"; }).join("");
    $("adLabel").innerHTML = Object.keys(A.LABELS).map(function (k) { return '<option value="' + k + '">' + esc(A.LABELS[k].id) + "</option>"; }).join("");
    $("adTones").innerHTML = A.TONES.map(function (t) { return '<button type="button" class="ad-tone ad-t-' + t.key + '" role="radio" aria-checked="false" data-tone="' + t.key + '"><i></i>' + esc(t.name) + "</button>"; }).join("");
  }
  function tone() { var b = $("adTones").querySelector('[aria-checked="true"]'); return b ? b.dataset.tone : "brand"; }
  function setTone(k) { [].forEach.call($("adTones").querySelectorAll("button"), function (b) { b.setAttribute("aria-checked", String(b.dataset.tone === k)); }); }
  function read() {
    return { id: editing && editing.id, lead_id: editing && editing.lead_id, slot: $("adSlot").value, title: $("adTitle").value, body: $("adBody").value, label: $("adLabel").value, url: $("adUrl").value,
      tone: tone(), city: $("adCity").value, weight: Number($("adWeight").value), starts_on: $("adStart").value, ends_on: $("adEnd").value, active: $("adActive").checked };
  }
  function preview() {
    var f = read(), s = A.slot(f.slot) || { fmt: "card", desc: "" };
    $("adSlotHint").textContent = s.desc || "";
    $("adWOut").textContent = f.weight;
    var ad = { title: f.title.trim() || "Judul lencana kamu", body: f.body.trim() || "Teks pendukung singkat muncul di sini.", label: f.label, tone: f.tone, url: A.safeUrl(f.url) || "https://contoh.id" };
    $("adPv").innerHTML = '<div class="ad-slot">' + A.badgeHtml(ad, { fmt: s.fmt, lang: "id" }) + "</div>";
  }
  function open(d, title) {
    d = d || {};
    editing = d.id || d.lead_id ? { id: d.id || null, lead_id: d.lead_id || null } : null;
    $("adDlgT").textContent = title;
    $("adSlot").value = d.slot || fSlot || "home_rail"; $("adTitle").value = d.title || ""; $("adBody").value = d.body || "";
    $("adLabel").value = d.label || "ad"; $("adUrl").value = d.url || ""; setTone(d.tone || "brand"); $("adCity").value = d.city || "";
    $("adWeight").value = d.weight || 5; $("adStart").value = d.starts_on || ""; $("adEnd").value = d.ends_on || ""; $("adActive").checked = d.active !== false;
    $("adErr").hidden = true; $("adErr").textContent = ""; preview();
    var dlg = $("adDlg"); if (!dlg.open) dlg.showModal();
  }
  function showErr(v) { var e = $("adErr"); e.textContent = v.msg; e.hidden = false; var el = { slot: "adSlot", title: "adTitle", body: "adBody", label: "adLabel", url: "adUrl", city: "adCity", weight: "adWeight", starts_on: "adStart", ends_on: "adEnd" }[v.field]; if (el && $(el)) try { $(el).focus(); } catch (x) {} }
  function save() {
    if (!canEdit()) return showErr({ msg: "Akun ini tidak punya izin mengubah iklan (butuh sponsor.manage)." });
    var f = read(), v = A.validate(f); if (!v.ok) return showErr(v);
    var b = $("adSave"); b.disabled = true;
    Promise.resolve(sb.rpc("admin_save_ad", A.buildSaveArgs(f))).then(function (r) {
      b.disabled = false;
      if (r.error) return showErr({ msg: friendlyErr(r.error) });
      $("adDlg").close(); msg(f.id ? "Lencana diperbarui." : "Lencana disimpan. Tampil di situs dalam beberapa menit.", "ok"); load(true);
    }, function (err) { b.disabled = false; showErr({ msg: friendlyErr(err) }); });
  }
  function byId(id) { return rows.filter(function (r) { return r.id === id; })[0]; }

  /* dari kartu Lead Sponsor: isi awal sesuai paket yang dibeli */
  function fromLead(l) {
    if (!l) return;
    if (!canEdit()) return msg("Akun ini tidak punya izin mengubah iklan.", "err");
    var go = document.querySelector('#admSide button[data-v="iklan"]'); if (go) go.click();
    var t = A.todayWIB();
    open({ lead_id: l.id, slot: LEAD_SLOT[l.package] || "event_list", title: l.event_title || l.organizer_name || "", label: "sponsor", city: l.city || "", weight: LEAD_W[l.package] || 5,
      starts_on: t, ends_on: addDays(t, (l.weeks || 1) * 7) }, "Lencana untuk " + (l.organizer_name || "lead sponsor"));
  }
  window.ADM_ADS = { fromLead: fromLead, reload: function () { load(true); } };

  /* ---------- peristiwa ---------- */
  fillStatic();
  ["adSlot", "adTitle", "adBody", "adLabel", "adUrl", "adWeight"].forEach(function (i) { $(i).addEventListener("input", preview); $(i).addEventListener("change", preview); });
  $("adTones").addEventListener("click", function (e) { var b = e.target.closest("[data-tone]"); if (b) { setTone(b.dataset.tone); preview(); } });
  $("adSave").addEventListener("click", save);
  $("adCancel").addEventListener("click", function () { $("adDlg").close(); });
  $("adNew").addEventListener("click", function () { open({ slot: fSlot || "home_rail" }, "Lencana baru"); });
  $("adRefresh").addEventListener("click", function () { load(true); });
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.v === "iklan") load(false);
    if (b.dataset.slot !== undefined && box.contains(b) && !b.dataset.adst) { fSlot = b.dataset.slot === fSlot ? "" : b.dataset.slot; draw(); }
    if (b.dataset.adst !== undefined && box.contains(b)) { fSt = b.dataset.adst; draw(); }
    if (b.dataset.adnew) open({ slot: b.dataset.adnew }, "Lencana baru");
    if (b.dataset.adedit) { var r = byId(b.dataset.adedit); if (r) open(r, "Ubah lencana"); }
    if (b.dataset.adtog) {
      var t = byId(b.dataset.adtog); if (!t) return; b.disabled = true;
      Promise.resolve(sb.rpc("admin_toggle_ad", { p_id: t.id, p_active: !t.active })).then(function (x) {
        b.disabled = false; if (x.error) return msg(friendlyErr(x.error), "err");
        msg(t.active ? "Lencana dinonaktifkan." : "Lencana diaktifkan.", "ok"); load(true);
      }, function (err) { b.disabled = false; msg(friendlyErr(err), "err"); });
    }
    if (b.dataset.addel) {
      var d = byId(b.dataset.addel); if (!d) return;
      (window.admAsk ? admAsk({ title: "Hapus lencana?", text: "\"" + d.title + "\" dihapus permanen. Untuk berhenti sementara, pakai Nonaktifkan.", ok: "Hapus" }) : Promise.resolve(true)).then(function (ok) {
        if (!ok) return;
        Promise.resolve(sb.rpc("admin_delete_ad", { p_id: d.id })).then(function (x) {
          if (x.error) return msg(friendlyErr(x.error), "err"); msg("Lencana dihapus.", "ok"); load(true);
        }, function (err) { msg(friendlyErr(err), "err"); });
      });
    }
  });
  /* muat otomatis saat menu dibuka lewat tombol seg di bagian lain juga sudah ditangani di atas (data-v="iklan") */
})();
