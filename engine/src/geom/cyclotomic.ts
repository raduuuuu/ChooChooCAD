/**
 * Exact arithmetic in Z[zeta16], the ring of 16th cyclotomic integers.
 *
 * zeta = e^(i*pi/8) is a primitive 16th root of unity, so rotation by 22.5
 * degrees is multiplication by zeta, and every BRIO heading is some zeta^h.
 * The minimal polynomial is x^8 + 1, hence zeta^8 = -1 and every element is
 *
 *     a0 + a1*zeta + a2*zeta^2 + ... + a7*zeta^7      with integer a_i.
 *
 * Why this matters: every straight length (54, 108, 144, 216) is an integer and
 * every curve displacement is an integer multiple of a difference of powers of
 * zeta (see pose.ts). So the closure residual of any layout is an EXACT element
 * of this ring, and "does this loop close" is an integer equality test. No
 * floating point, no convergence, no NaN.
 *
 *     8 x E curve  ->  residual exactly 0, provable by telescoping
 *
 * Floats appear only in toXY, for rendering and for the linear-programming
 * sensitivities. Never for the closure test itself.
 */

/** 8 integer coefficients of zeta^0 .. zeta^7. */
export type Cyc = readonly [number, number, number, number, number, number, number, number];

const DEG = 8;

export const ZERO: Cyc = [0, 0, 0, 0, 0, 0, 0, 0];

export function fromInt(n: number): Cyc {
  return [n, 0, 0, 0, 0, 0, 0, 0];
}

export function add(a: Cyc, b: Cyc): Cyc {
  return a.map((v, i) => v + b[i]!) as unknown as Cyc;
}

export function sub(a: Cyc, b: Cyc): Cyc {
  return a.map((v, i) => v - b[i]!) as unknown as Cyc;
}

export function scale(a: Cyc, k: number): Cyc {
  return a.map((v) => v * k) as unknown as Cyc;
}

export function isZero(a: Cyc): boolean {
  return a.every((v) => v === 0);
}

export function equals(a: Cyc, b: Cyc): boolean {
  return isZero(sub(a, b));
}

/**
 * Multiply by zeta^k for any integer k (negative allowed).
 *
 * zeta^8 = -1, so a coefficient shifted past index 7 wraps with a sign flip.
 * zeta^16 = 1, so k is meaningful modulo 16.
 */
export function mulZetaPow(a: Cyc, k: number): Cyc {
  const out = [0, 0, 0, 0, 0, 0, 0, 0];
  const kk = ((k % (2 * DEG)) + 2 * DEG) % (2 * DEG); // 0..15
  for (let i = 0; i < DEG; i++) {
    const coeff = a[i]!;
    if (coeff === 0) continue;
    let j = i + kk;
    let sign = 1;
    while (j >= DEG) {
      j -= DEG;
      sign = -sign;
    }
    out[j]! += sign * coeff;
  }
  return out as unknown as Cyc;
}

/** zeta^k as a ring element. */
export function zetaPow(k: number): Cyc {
  return mulZetaPow(fromInt(1), k);
}

/**
 * Project to the complex plane as [x, y] in millimetres.
 * Lossy by construction: use for rendering and LP sensitivities only, never to
 * decide closure.
 */
export function toXY(a: Cyc): [number, number] {
  let x = 0;
  let y = 0;
  for (let i = 0; i < DEG; i++) {
    const c = a[i]!;
    if (c === 0) continue;
    const ang = (i * Math.PI) / DEG;
    x += c * Math.cos(ang);
    y += c * Math.sin(ang);
  }
  return [x, y];
}

/** Euclidean magnitude in millimetres. Lossy; for reporting a gap to a user. */
export function magnitude(a: Cyc): number {
  const [x, y] = toXY(a);
  return Math.hypot(x, y);
}
