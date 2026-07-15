// ============================================================
// Adaptive testing engine (Computerized Adaptive Testing)
// ------------------------------------------------------------
// Model: 1-parameter logistic (Rasch). Each question has a
// difficulty b (in logits). The candidate has an ability
// estimate theta, re-estimated after every response with
// MAP (maximum a posteriori) under a N(0,1) prior, which keeps
// the estimate stable when all answers so far are right/wrong.
//
// Selection: next question targets the candidate's current
// theta while keeping the domain mix close to the official
// exam blueprint. Stopping: once the minimum length is reached,
// the exam ends early when the confidence interval around theta
// is entirely above or below the proficiency threshold —
// the same idea the real CISSP CAT exam uses.
// ============================================================

(function () {
  const cfg = () => window.CISSP_CONFIG;

  function probCorrect(theta, b) {
    return 1 / (1 + Math.exp(-(theta - b)));
  }

  // MAP estimate of theta given responses [{b, correct}]
  function estimateTheta(responses) {
    let theta = 0;
    const priorVar = 1.0;
    for (let iter = 0; iter < 25; iter++) {
      let grad = -(theta / priorVar);
      let hess = -(1 / priorVar);
      for (const r of responses) {
        const p = probCorrect(theta, r.b);
        grad += (r.correct ? 1 : 0) - p;
        hess -= p * (1 - p);
      }
      const step = grad / hess;
      theta -= step;
      if (Math.abs(step) < 1e-4) break;
    }
    const c = cfg().THETA_CLAMP;
    theta = Math.max(-c, Math.min(c, theta));
    // Standard error from observed information (incl. prior)
    let info = 1 / priorVar;
    for (const r of responses) {
      const p = probCorrect(theta, r.b);
      info += p * (1 - p);
    }
    return { theta, se: 1 / Math.sqrt(info) };
  }

  class AdaptiveExam {
    /**
     * @param {Array} bank - question objects {id, domain, question, options, answer, explanation, difficulty}
     * @param {string} mode - "short" | "medium" | "full"
     */
    constructor(bank, mode) {
      this.mode = mode;
      this.limits = cfg().MODES[mode];
      this.bank = bank.slice();
      this.remaining = new Map(bank.map(q => [q.id, q]));
      this.responses = [];       // {q, chosen, correct, b, domain, timeMs}
      this.theta = 0;
      this.se = 1.0;
      this.domainCounts = {};
      for (const d of Object.keys(cfg().DOMAIN_WEIGHTS)) this.domainCounts[d] = 0;
      this.finished = false;
      this.endReason = null;     // "confident" | "max" | "time" | "quit"
      this.current = null;
    }

    answered() { return this.responses.length; }

    // Pick the domain furthest below its blueprint share
    _pickDomain() {
      const weights = cfg().DOMAIN_WEIGHTS;
      const total = Math.max(1, this.answered());
      let best = null, bestDeficit = -Infinity;
      for (const d of Object.keys(weights)) {
        const hasQuestions = [...this.remaining.values()].some(q => String(q.domain) === d);
        if (!hasQuestions) continue;
        const deficit = weights[d] - (this.domainCounts[d] / total);
        if (deficit > bestDeficit) { bestDeficit = deficit; best = d; }
      }
      return best;
    }

    nextQuestion() {
      if (this.finished) return null;
      const domain = this._pickDomain();
      if (domain === null) { this._end("max"); return null; }
      const pool = [...this.remaining.values()].filter(q => String(q.domain) === domain);
      // 3 questions closest in difficulty to current theta; pick one at
      // random so two candidates at the same level don't get identical exams
      pool.sort((a, b) =>
        Math.abs(a.difficulty - this.theta) - Math.abs(b.difficulty - this.theta));
      const top = pool.slice(0, Math.min(3, pool.length));
      this.current = top[Math.floor(Math.random() * top.length)];
      return this.current;
    }

    /** @returns {{correct:boolean, done:boolean}} */
    submitAnswer(chosenIndex, timeMs) {
      const q = this.current;
      if (!q || this.finished) return { correct: false, done: true };
      const correct = chosenIndex === q.answer;
      this.remaining.delete(q.id);
      this.domainCounts[String(q.domain)]++;
      this.responses.push({
        q, chosen: chosenIndex, correct,
        b: q.difficulty, domain: q.domain, timeMs: timeMs || 0
      });
      const est = estimateTheta(this.responses.map(r => ({ b: r.b, correct: r.correct })));
      this.theta = est.theta;
      this.se = est.se;
      this.current = null;
      this._checkStop();
      return { correct, done: this.finished };
    }

    _checkStop() {
      const n = this.answered();
      if (n >= this.limits.max || this.remaining.size === 0) {
        this._end("max");
        return;
      }
      if (n >= this.limits.min) {
        const z = cfg().CONFIDENCE_Z, pass = cfg().PASS_THETA;
        const lo = this.theta - z * this.se;
        const hi = this.theta + z * this.se;
        if (lo > pass || hi < pass) this._end("confident");
      }
    }

    timeExpired() { if (!this.finished) this._end("time"); }
    quit()        { if (!this.finished) this._end("quit"); }

    _end(reason) {
      this.finished = true;
      this.endReason = reason;
    }

    passed() {
      // On early confident stop, the interval decides; otherwise point estimate
      return this.theta >= cfg().PASS_THETA;
    }

    // Per-domain proficiency: mini-MAP per domain with a strong pull
    // toward the overall theta (few items per domain otherwise)
    domainReport() {
      const report = [];
      for (const d of Object.keys(cfg().DOMAIN_WEIGHTS)) {
        const rs = this.responses.filter(r => String(r.domain) === d);
        if (rs.length === 0) {
          report.push({ domain: Number(d), name: cfg().DOMAIN_NAMES[d], items: 0, level: "—" });
          continue;
        }
        let t = this.theta;
        for (let i = 0; i < 15; i++) {
          let grad = -(t - this.theta) / 0.5;
          let hess = -(1 / 0.5);
          for (const r of rs) {
            const p = probCorrect(t, r.b);
            grad += (r.correct ? 1 : 0) - p;
            hess -= p * (1 - p);
          }
          t -= grad / hess;
        }
        const diff = t - cfg().PASS_THETA;
        const level = diff > 0.35 ? "Above Proficiency"
                    : diff < -0.35 ? "Below Proficiency"
                    : "Near Proficiency";
        report.push({ domain: Number(d), name: cfg().DOMAIN_NAMES[d], items: rs.length, level });
      }
      return report;
    }

    summary() {
      return {
        mode: this.mode,
        questions: this.answered(),
        correct: this.responses.filter(r => r.correct).length,
        theta: this.theta,
        se: this.se,
        passed: this.passed(),
        endReason: this.endReason,
        domains: this.domainReport(),
        responses: this.responses
      };
    }
  }

  window.AdaptiveExam = AdaptiveExam;
  window.CATMath = { probCorrect, estimateTheta };
})();
