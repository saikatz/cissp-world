// ============================================================
// Persistence + auth layer.
// Uses Supabase when configured in js/config.js; otherwise
// falls back to Practice Mode (localStorage, this browser only).
// ============================================================

(function () {
  const cfg = window.CISSP_CONFIG;
  const hasSupabase = () =>
    cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase;

  let sb = null;
  if (hasSupabase()) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  const LS_USER = "cissp_world_local_user";
  const LS_EXAMS = "cissp_world_exams";

  const Store = {
    cloud: !!sb,

    // ---------- auth ----------
    async signUp(email, password, displayName) {
      if (sb) {
        const { data, error } = await sb.auth.signUp({
          email, password, options: { data: { display_name: displayName } }
        });
        if (error) throw error;
        return data.user;
      }
      const user = { id: "local", email, display_name: displayName || email.split("@")[0] };
      localStorage.setItem(LS_USER, JSON.stringify(user));
      return user;
    },

    async signIn(email, password) {
      if (sb) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data.user;
      }
      const user = { id: "local", email, display_name: email.split("@")[0] };
      localStorage.setItem(LS_USER, JSON.stringify(user));
      return user;
    },

    async signOut() {
      if (sb) await sb.auth.signOut();
      localStorage.removeItem(LS_USER);
    },

    async currentUser() {
      if (sb) {
        const { data } = await sb.auth.getUser();
        return data.user || null;
      }
      const raw = localStorage.getItem(LS_USER);
      return raw ? JSON.parse(raw) : null;
    },

    async guest() {
      const user = { id: "guest", email: "", display_name: "Guest Candidate", guest: true };
      localStorage.setItem(LS_USER, JSON.stringify(user));
      return user;
    },

    displayName(user) {
      if (!user) return "Candidate";
      return user.display_name
        || (user.user_metadata && user.user_metadata.display_name)
        || (user.email ? user.email.split("@")[0] : "Candidate");
    },

    // ---------- exam results ----------
    async saveExam(user, summary) {
      const record = {
        mode: summary.mode,
        questions: summary.questions,
        correct: summary.correct,
        theta: Number(summary.theta.toFixed(3)),
        se: Number(summary.se.toFixed(3)),
        passed: summary.passed,
        end_reason: summary.endReason,
        domains: summary.domains,
        taken_at: new Date().toISOString()
      };
      if (sb && user && !user.guest) {
        const { data, error } = await sb.from("exams")
          .insert({ ...record, user_id: user.id })
          .select().single();
        if (error) { console.error("saveExam:", error.message); return record; }
        // Store individual responses for future difficulty calibration
        const rows = summary.responses.map(r => ({
          exam_id: data.id, user_id: user.id, question_id: r.q.id,
          correct: r.correct, time_ms: r.timeMs
        }));
        const { error: e2 } = await sb.from("responses").insert(rows);
        if (e2) console.error("saveResponses:", e2.message);
        return data;
      }
      const all = JSON.parse(localStorage.getItem(LS_EXAMS) || "[]");
      all.unshift(record);
      localStorage.setItem(LS_EXAMS, JSON.stringify(all.slice(0, 100)));
      return record;
    },

    async examHistory(user) {
      if (sb && user && !user.guest) {
        const { data, error } = await sb.from("exams")
          .select("*").order("taken_at", { ascending: false }).limit(50);
        if (error) { console.error("history:", error.message); return []; }
        return data;
      }
      return JSON.parse(localStorage.getItem(LS_EXAMS) || "[]");
    }
  };

  window.Store = Store;
})();
