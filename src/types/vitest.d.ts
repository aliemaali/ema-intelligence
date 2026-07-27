declare module 'vitest' {
  export function describe(name: string, fn: () => void): void
  export function it(name: string, fn: () => void | Promise<void>): void

  interface Matchers {
    toBe(expected: unknown): void
    toBeCloseTo(expected: number, precision?: number): void
    toContain(expected: unknown): void
    toHaveLength(expected: number): void
    toBeGreaterThan(expected: number): void
  }

  export function expect(actual: unknown): Matchers
}
