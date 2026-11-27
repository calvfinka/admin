/* Panel /admin. Hanya app_metadata.role = admin. Tidak menyimpan kunci. */
(function () {
  "use strict";
  var sb = null;
  var picked = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return "&#" + c.charCodeAt(0) + ";";
    });
  }
  function when(v) {
    if (!v) return "–";
    var d = new Date(v);
    if (isNaN(d.getTime())) return "–";
    return d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
  }
  function num(v) {
    var n = Number(v || 0);
    return n.toLocaleString("id-ID");
  }

  function showGate(msg) {
    $("gate").hidden = false;
    $("app").hidden = true;
    $("out").hidden = true;
    $("who").textContent = "Belum masuk";
    $("gate-msg").textContent = msg || "";
  }

  async function boot() {
    try {
      sb = await window.deaSupabase();
    } catch (e) {
      sb = null;
    }
    if (!sb) {
      showGate("SUPABASE_URL dan SUPABASE_ANON_KEY belum diisi di js/env.js.");
      return;
    }
    var session = await sb.auth.getSession();
    var s = session.data && session.data.session;
    if (!s) { showGate(""); return; }
    await enter(s);
  }

  async function enter(session) {
    var role = session.user && session.user.app_metadata && session.user.app_metadata.role;
    if (role !== "admin") {
      await sb.auth.signOut({ scope: "local" });
      showGate("Akun ini bukan admin.");
      return;
    }
    $("gate").hidden = true;
    $("app").hidden = false;
    $("out").hidden = false;
    $("who").textContent = session.user.email || "Admin";
    await refresh();
  }

  async function refresh() {
    $("list-msg").textContent = "";
    var stats = await sb.rpc("dea_admin_stats");
    if (stats.error) {
      $("list-msg").textContent = stats.error.message || "Gagal memuat.";
      return;
    }
    var d = stats.data || {};
    $("n-user").textContent = num(d.total_user);
    $("n-new").textContent = num(d.user_baru_hari_ini);
    $("n-chat").textContent = num(d.total_chat);
    await loadUsers();
  }

  async function loadUsers() {
    var r = await sb.rpc("dea_admin_users", { p_q: $("q").value || null, p_filter: $("filter").value || "all" });
    if (r.error) { $("list-msg").textContent = r.error.message || "Gagal memuat user."; return; }
    var rows = Array.isArray(r.data) ? r.data : [];
    $("rows").innerHTML = rows.map(function (u) {
      var on = picked === u.id ? " on" : "";
      var tag = u.is_blocked ? '<span class="tag bad">blokir</span>' : '<span class="tag">aktif</span>';
      return '<tr class="pick' + on + '" data-id="' + esc(u.id) + '">' +
        "<td>" + esc(u.nama || "–") + "<br>" + tag + "</td>" +
        "<td>" + esc(u.email || "–") + "</td>" +
        "<td>" + num(u.total_chat) + "</td>" +
        "<td>" + esc(when(u.last_active || u.created_at)) + "</td>" +
        '<td><div class="row-actions">' +
        '<button type="button" class="btn" data-act="block" data-id="' + esc(u.id) + '" data-blocked="' + (u.is_blocked ? "1" : "0") + '">' + (u.is_blocked ? "Buka blokir" : "Blokir") + "</button>" +
        '<button type="button" class="btn danger" data-act="del" data-id="' + esc(u.id) + '">Hapus</button>' +
        "</div></td></tr>";
    }).join("") || '<tr><td colspan="5" class="muted">Tidak ada user.</td></tr>';
  }

  async function openUser(id, label) {
    picked = id;
    $("detail").hidden = false;
    $("detail-title").textContent = "Riwayat · " + (label || "user");
    $("history").innerHTML = '<p class="muted">Memuat…</p>';
    await loadUsers();
    var r = await sb.rpc("dea_admin_chats", { p_user: id });
    if (r.error) { $("history").innerHTML = '<p class="err">' + esc(r.error.message || "Gagal") + "</p>"; return; }
    var rows = Array.isArray(r.data) ? r.data : [];
    $("history").innerHTML = rows.map(function (c) {
      return '<article class="bubble"><b>' + esc(when(c.created_at)) + "</b>" +
        "<div><b>User</b>" + esc(c.message) + "</div>" +
        "<div><b>Dea</b>" + esc(c.reply) + "</div></article>";
    }).join("") || '<p class="muted">Belum ada chat.</p>';
  }

  $("in").addEventListener("click", async function () {
    $("gate-msg").textContent = "";
    if (!sb) { $("gate-msg").textContent = "Koneksi Supabase belum ada. Isi js/env.js dulu."; return; }
    var r = await sb.auth.signInWithPassword({ email: $("email").value.trim(), password: $("pass").value });
    if (r.error) { $("gate-msg").textContent = "Email atau password salah."; return; }
    await enter(r.data.session);
  });
  $("out").addEventListener("click", async function () {
    await sb.auth.signOut({ scope: "local" });
    picked = null;
    showGate("");
  });
  var timer;
  $("q").addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(loadUsers, 250); });
  $("filter").addEventListener("change", loadUsers);
  $("rows").addEventListener("click", async function (e) {
    var btn = e.target.closest("button");
    if (btn) {
      var id = btn.getAttribute("data-id");
      if (btn.getAttribute("data-act") === "block") {
        var next = btn.getAttribute("data-blocked") !== "1";
        var r = await sb.rpc("dea_admin_block", { p_user: id, p_blocked: next });
        if (r.error) { $("list-msg").textContent = r.error.message || "Gagal mengubah blokir."; return; }
        await loadUsers();
        return;
      }
      if (btn.getAttribute("data-act") === "del") {
        if (!confirm("Hapus user ini dari panel beserta riwayat chatnya?")) return;
        var d = await sb.rpc("dea_admin_delete", { p_user: id });
        if (d.error) { $("list-msg").textContent = d.error.message || "Gagal menghapus."; return; }
        if (picked === id) { picked = null; $("detail").hidden = true; }
        await refresh();
      }
      return;
    }
    var tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    openUser(tr.getAttribute("data-id"), tr.children[0].innerText.split("\n")[0]);
  });

  boot();
})();
