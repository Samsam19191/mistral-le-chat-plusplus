export function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function containsAll(text: string, needles: string[]): boolean {
  const normalizedText = normalize(text);
  return needles.every(needle => normalizedText.includes(normalize(needle)));
}

export function scoreContainsAll(
  output: string, 
  expectContains: string[]
): { pass: boolean; hits: number; total: number } {
  const normalizedOutput = normalize(output);
  const hits = expectContains.filter(needle => 
    normalizedOutput.includes(normalize(needle))
  ).length;
  
  const useOrLogic = isAlternativesList(expectContains);
  const pass = useOrLogic ? hits > 0 : hits === expectContains.length;
  
  return {
    pass,
    hits,
    total: expectContains.length
  };
}

function isAlternativesList(items: string[]): boolean {
  if (items.length <= 1) return false;
  
  const allSimple = items.every(item => /^\w+$/.test(item.trim()));
  if (allSimple && items.length > 2) return true;
  
  if (items.length === 2) {
    const hasNumber = items.some(item => /^\d+$/.test(item.trim()));
    const hasWord = items.some(item => /^[a-zA-Z]+$/.test(item.trim()));
    if (hasNumber && hasWord) return true;
  }
  
  const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet', 'purple', 'pink', 'brown', 'black', 'white'];
  const colorCount = items.filter(item => colors.includes(item.toLowerCase().trim())).length;
  if (colorCount >= 3) return true;
  
  return false;
}

export function computeStats(
  samples: Array<{ latencyMs: number; pass: boolean; tokensUsed?: number }>
): { count: number; passRate: number; p50: number; p95: number; avgTokens?: number; totalTokens?: number } {
  const count = samples.length;
  
  if (count === 0) {
    return {
      count: 0,
      passRate: NaN,
      p50: NaN,
      p95: NaN
    };
  }

  const passCount = samples.filter(s => s.pass).length;
  const passRate = passCount / count;

  const latencies = samples.map(s => s.latencyMs).sort((a, b) => a - b);
  
  const p50 = count >= 1 ? percentile(latencies, 0.5) : NaN;
  const p95 = count >= 1 ? percentile(latencies, 0.95) : NaN;

  const tokensValues = samples.map(s => s.tokensUsed).filter((t): t is number => t !== undefined);
  const hasTokens = tokensValues.length > 0;
  
  const avgTokens = hasTokens ? tokensValues.reduce((sum, t) => sum + t, 0) / tokensValues.length : undefined;
  const totalTokens = hasTokens ? tokensValues.reduce((sum, t) => sum + t, 0) : undefined;

  return {
    count,
    passRate,
    p50,
    p95,
    ...(avgTokens !== undefined && { avgTokens }),
    ...(totalTokens !== undefined && { totalTokens }),
  };
}

function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return NaN;
  if (sortedArray.length === 1) return sortedArray[0]!;
  
  const index = p * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  
  if (lower === upper) {
    return sortedArray[lower]!;
  }
  
  const weight = index - lower;
  return sortedArray[lower]! * (1 - weight) + sortedArray[upper]! * weight;
}