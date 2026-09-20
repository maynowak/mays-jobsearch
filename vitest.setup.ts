import { expect, vi } from "vitest";
globalThis.expect = expect;
globalThis.vi = vi;

// Polyfill for DOMMatrix (used by pdfjs-dist)
if (typeof globalThis.DOMMatrix === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.DOMMatrix = class DOMMatrix {
    a: number; b: number; c: number; d: number; e: number; f: number;
    m11: number; m12: number; m13: number; m14: number;
    m21: number; m22: number; m23: number; m24: number;
    m31: number; m32: number; m33: number; m34: number;
    m41: number; m42: number; m43: number; m44: number;
    is2D: boolean; isIdentity: boolean;
    constructor(init?: string | number[]) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
      this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
      this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
      this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
      this.is2D = true; this.isIdentity = true;
    }
    multiply(): DOMMatrix { return new DOMMatrix(); }
    inverse(): DOMMatrix { return new DOMMatrix(); }
    translate(): DOMMatrix { return new DOMMatrix(); }
    scale(): DOMMatrix { return new DOMMatrix(); }
    rotate(): DOMMatrix { return new DOMMatrix(); }
    rotateAxisAngle(): DOMMatrix { return new DOMMatrix(); }
    skewX(): DOMMatrix { return new DOMMatrix(); }
    skewY(): DOMMatrix { return new DOMMatrix(); }
    flipX(): DOMMatrix { return new DOMMatrix(); }
    flipY(): DOMMatrix { return new DOMMatrix(); }
    toFloat32Array(): Float32Array { return new Float32Array(16); }
    toFloat64Array(): Float64Array { return new Float64Array(16); }
    toJSON(): string { return "{}"; }
  } as any;
}

// Dynamic import to ensure expect is available first
import("@testing-library/jest-dom");