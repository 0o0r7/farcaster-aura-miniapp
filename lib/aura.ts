// lib/aura.ts
// Deterministic, rule-based Aura engine (no AI).
// Feed it basic Farcaster stats → get Aura type + score + explanation.

export type AuraType =
  | "BUILDER"
  | "CREATOR"
  | "INFLUENCER"
  | "THINKER"
  | "DEGEN"
  | "LURKER";

export type AuraEmoji = "🛠" | "🎨" | "📣" | "🧠" | "🎰" | "👀";

export interface AuraInputs {
  // Farcaster activity (ideally last 30 days, but any window works if consistent)
  casts: number; // posts
  replies: number; // replies (or comments)
  reactionsReceived: number; // likes/recasts/etc received
  followers: number; // follower count

  // Optional “style” signals (0..1). If you don’t have these yet, pass undefined.
  // longCastRatio: fraction of casts that are “long” (e.g. > 200 chars) in the window
  longCastRatio?: number; // 0..1
  // mediaCastRatio: fraction of casts containing media (image/video) in the window
  mediaCastRatio?: number; // 0..1

  // Optional Base signal (0..N). Can be 30d tx count, lifetime tx count, etc.
  baseTxCount?: number;
}

export interface AuraBreakdown {
  activity: number; // 0..100
  impact: number; // 0..100
  social: number; // 0..100
  style: number; // 0..100
  onchain: number; // 0..100
}

export interface AuraResult {
  type: AuraType;
  score: number; // 0..100
  emoji: AuraEmoji;
  label: string; // pretty name
  description: string; // one-liner
  breakdown: AuraBreakdown;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clamp01 = (n: number) => clamp(n, 0, 1);

// Log-ish normalization so whales don’t nuke the curve.
// `cap` is the point where it ~tops out near 100.
function logScore(value: number, cap: number): number {
  const v = Math.max(0, value);
  const c = Math.max(1, cap);
  // log10(1+v) / log10(1+c) → 0..1
  const r = Math.log10(1 + v) / Math.log10(1 + c);
  return Math.round(clamp(r * 100, 0, 100));
}

function pickAuraType(inputs: AuraInputs, breakdown: AuraBreakdown): AuraType {
  const casts = Math.max(0, inputs.casts);
  const replies = Math.max(0, inputs.replies);
  const longRatio = clamp01(inputs.longCastRatio ?? 0);
  const mediaRatio = clamp01(inputs.mediaCastRatio ?? 0);
  const onchain = breakdown.onchain;

  // Feature-ish scores (0..100-ish), deterministic.
  // These are intentionally simple and explainable.
  const builder = breakdown.activity * 0.6 + breakdown.impact * 0.2 + (replies > casts ? 10 : 0);
  const creator = breakdown.style * 0.75 + breakdown.impact * 0.15 + breakdown.activity * 0.1;
  const influencer = breakdown.social * 0.45 + breakdown.impact * 0.45 + breakdown.activity * 0.1;
  const thinker = breakdown.style * 0.55 + breakdown.activity * 0.35 + (longRatio > 0.35 ? 10 : 0);
  const degen = onchain * 0.65 + breakdown.activity * 0.2 + breakdown.impact * 0.15;

  // Lurker logic: very low activity OR basically no footprint.
  const totalActivity = casts + replies;
  const isLurker =
    totalActivity <= 2 ||
    (breakdown.activity <= 12 && breakdown.impact <= 12 && breakdown.social <= 12);

  if (isLurker) return "LURKER";

  // Choose max
  const entries: Array<[AuraType, number]> = [
    ["BUILDER", builder],
    ["CREATOR", creator],
    ["INFLUENCER", influencer],
    ["THINKER", thinker],
    ["DEGEN", degen],
  ];

  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]![0];
}

function meta(type: AuraType): { emoji: AuraEmoji; label: string; description: string } {
  switch (type) {
    case "BUILDER":
      return { emoji: "🛠", label: "Builder Aura", description: "You ship more than you talk. Keep building." };
    case "CREATOR":
      return { emoji: "🎨", label: "Creator Aura", description: "Taste + output. You make the timeline prettier." };
    case "INFLUENCER":
      return { emoji: "📣", label: "Influencer Aura", description: "You move attention. The feed follows your signal." };
    case "THINKER":
      return { emoji: "🧠", label: "Thinker Aura", description: "Depth merchant. Your replies add real brainpower." };
    case "DEGEN":
      return { emoji: "🎰", label: "Degen Aura", description: "Onchain instincts. You’re early, often, and unbothered." };
    case "LURKER":
      return { emoji: "👀", label: "Lurker Aura", description: "Silent watcher. Your aura is mysterious (and powerful)." };
  }
}

export function computeAura(inputs: AuraInputs): AuraResult {
  // Core components (tunable caps):
  // These caps define where “100” roughly tops out for each dimension.
  const activityRaw = inputs.casts + inputs.replies * 1.2;
  const impactRaw = inputs.reactionsReceived;
  const socialRaw = inputs.followers;

  const activity = logScore(activityRaw, 120); // ~100 around 120 weighted actions
  const impact = logScore(impactRaw, 250); // ~100 around 250 reactions received
  const social = logScore(socialRaw, 2000); // ~100 around 2k followers

  const longRatio = clamp01(inputs.longCastRatio ?? 0);
  const mediaRatio = clamp01(inputs.mediaCastRatio ?? 0);
  // Style is optional; if no data, it stays low but not broken.
  const style = Math.round(clamp((longRatio * 55 + mediaRatio * 45), 0, 100));

  const baseTx = Math.max(0, inputs.baseTxCount ?? 0);
  const onchain = logScore(baseTx, 40); // ~100 around 40 tx (per chosen window)

  const breakdown: AuraBreakdown = { activity, impact, social, style, onchain };

  const type = pickAuraType(inputs, breakdown);
  const { emoji, label, description } = meta(type);

  // Final score weights (simple + fair)
  // Lurker score intentionally isn’t always “0” — it can still be cool.
  const weighted =
    activity * 0.35 +
    impact * 0.30 +
    social * 0.20 +
    style * 0.10 +
    onchain * 0.05;

  const score = type === "LURKER"
    ? Math.round(clamp(weighted * 0.7 + 10, 0, 60)) // cap lurker vibe
    : Math.round(clamp(weighted, 0, 100));

  return { type, score, emoji, label, description, breakdown };
    }
