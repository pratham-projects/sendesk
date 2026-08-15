/**
 * Deterministic seeded PRNG (mulberry32) plus small helpers.
 * Never use Math.random() in the mock layer — seeded output keeps every
 * demo session reproducible and keeps diffs against upstream to zero.
 */

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function rand() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export class Rng {
  private rand: () => number

  constructor(seed: number | string) {
    this.rand = mulberry32(typeof seed === "string" ? hashSeed(seed) : seed)
  }

  next(): number {
    return this.rand()
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)]
  }

  pickMany<T>(arr: readonly T[], count: number): T[] {
    const pool = [...arr]
    const out: T[] = []
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = this.int(0, pool.length - 1)
      out.push(pool[idx])
      pool.splice(idx, 1)
    }
    return out
  }

  id(prefix: string): string {
    const n = this.int(0, 0xffffffff).toString(36)
    return `${prefix}_${n}${this.int(0, 999).toString(36)}`
  }
}
