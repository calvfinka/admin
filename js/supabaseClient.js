/* Klien Supabase untuk halaman admin. Tidak ada kunci di berkas ini. */
(function (w) {
  "use strict";
  var LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";

  function readEnv() {
    var e = w.DEA_ENV || {};
    return {
      url: String(e.SUPABASE_URL || "").trim(),
      key: String(e.SUPABASE_ANON_KEY || "").trim()
    };
  }

  w.deaSupabaseEnv = readEnv;

  w.deaSupabase = function () {
    var e = readEnv();
    if (!e.url || !e.key) return Promise.resolve(null);
    if (w.__deaSb) return Promise.resolve(w.__deaSb);
    return new Promise(function (ok, fail) {
      function make() {
        if (!w.supabase || !w.supabase.createClient) return fail(new Error("supabase"));
        w.__deaSb = w.supabase.createClient(e.url, e.key, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
        ok(w.__deaSb);
      }
      if (w.supabase && w.supabase.createClient) return make();
      var s = document.createElement("script");
      s.src = LIB;
      s.async = true;
      s.onload = make;
      s.onerror = function () { fail(new Error("supabase")); };
      document.head.appendChild(s);
    });
  };
})(window);
