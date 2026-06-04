/**
 * Lightweight fuzzy / typo-tolerant matcher for in-memory search.
 *
 * Returns a 0–1 score for how well `query` matches `text`:
 *  - 1.00 → exact prefix match
 *  - 0.90 → exact substring match (mid-word)
 *  - 0.55–0.75 → subsequence (chars in order with gaps)
 *  - 0.30–0.50 → edit-distance match (handles single typos / transpositions)
 *  - 0.00 → no useful match
 *
 * Use `fuzzyFilter` to filter and sort a list of items by a key extractor.
 */

function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const dp: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) dp[i][0] = i;
  for (let j = 0; j <= bl; j++) dp[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,        // deletion
        dp[i][j - 1] + 1,        // insertion
        dp[i - 1][j - 1] + cost  // substitution
      );
      // Transposition (Damerau extension)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[al][bl];
}

export function fuzzyScore(rawQuery: string, rawText: string): number {
  const q = (rawQuery ?? "").toLowerCase().trim();
  const t = (rawText ?? "").toLowerCase();
  if (!q) return 1;
  if (!t) return 0;

  // 1. Exact substring (priority for prefix vs middle)
  const idx = t.indexOf(q);
  if (idx === 0) return 1.0;
  if (idx > 0) return 0.9 - Math.min(idx / 80, 0.15); // slight penalty for late matches

  // 2. Subsequence (all query chars present in order)
  let qi = 0;
  let consecutive = 0;
  let maxConsecutive = 0;
  let firstMatch = -1;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      if (firstMatch === -1) firstMatch = i;
      consecutive++;
      maxConsecutive = Math.max(maxConsecutive, consecutive);
      qi++;
    } else {
      consecutive = 0;
    }
  }
  if (qi === q.length) {
    const tight = maxConsecutive / q.length;       // 0..1
    const compact = q.length / Math.max(1, t.length - firstMatch);
    return 0.55 + tight * 0.15 + compact * 0.05;   // 0.55..0.75
  }

  // 3. Edit-distance fallback for typos. Only meaningful for short-ish queries.
  if (q.length < 3) return 0;
  // Compare against best matching window of t (length ~q)
  const window = Math.min(q.length + 2, t.length);
  let best = q.length;
  for (let i = 0; i + window <= t.length; i++) {
    const d = damerauLevenshtein(q, t.substring(i, i + window));
    if (d < best) best = d;
    if (best === 0) break;
  }
  // Also compare to entire text (cheap for short text)
  const dAll = damerauLevenshtein(q, t.substring(0, Math.min(t.length, q.length + 3)));
  if (dAll < best) best = dAll;

  const tolerance = q.length <= 4 ? 1 : q.length <= 6 ? 2 : 3;
  if (best <= tolerance) {
    return 0.5 - (best / (tolerance + 1)) * 0.2;   // 0.30..0.50
  }
  return 0;
}

/**
 * Filter and sort a list by fuzzy match against one or more keys.
 *
 * @param items   the source list
 * @param query   the user's search input
 * @param keys    functions returning searchable text for an item; the best
 *                score across keys is used. Earlier keys are weighted higher
 *                (multiplied by 1.0, 0.9, 0.8 ...).
 * @param min     minimum score to keep an item (default 0.30)
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  keys: Array<(item: T) => string | undefined | null>,
  min = 0.3
): T[] {
  const q = query.trim();
  if (!q) return items;
  const scored = items
    .map((item) => {
      let best = 0;
      keys.forEach((getKey, ki) => {
        const text = getKey(item) ?? "";
        const s = fuzzyScore(q, text) * (1 - ki * 0.1);
        if (s > best) best = s;
      });
      return { item, score: best };
    })
    .filter((s) => s.score >= min)
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}
