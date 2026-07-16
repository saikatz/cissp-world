// ============================================================
// cissp.world configuration
// ============================================================
// To enable real accounts (sync across devices), create a free
// Supabase project (see SETUP.md) and paste its URL and anon
// public key below. Until then the app runs in Practice Mode
// and stores progress in this browser only.
// ============================================================
window.CISSP_CONFIG = {
  SUPABASE_URL: "https://gmixlpcgzcbvfrygikng.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_0X698DNa-cEPpp2P50Z09A_FMv59Y6y",

  // Exam modes: max questions, minimum before early stop, minutes
  MODES: {
    short:  { label: "Short Exam",  max: 50,  min: 25,  minutes: 60  },
    medium: { label: "Medium Exam", max: 100, min: 50,  minutes: 120 },
    full:   { label: "Full Exam",   max: 150, min: 100, minutes: 180 }
  },

  // CAT parameters
  PASS_THETA: 0.0,        // ability level that counts as "proficient"
  CONFIDENCE_Z: 1.65,     // ~95% one-sided confidence for early stop
  THETA_CLAMP: 3.0,

  // Official CISSP domain blueprint weights (2024 exam outline)
  DOMAIN_WEIGHTS: {
    1: 0.16, 2: 0.10, 3: 0.13, 4: 0.13,
    5: 0.13, 6: 0.12, 7: 0.13, 8: 0.10
  },

  DOMAIN_NAMES: {
    1: "Security and Risk Management",
    2: "Asset Security",
    3: "Security Architecture and Engineering",
    4: "Communication and Network Security",
    5: "Identity and Access Management (IAM)",
    6: "Security Assessment and Testing",
    7: "Security Operations",
    8: "Software Development Security"
  }
};
