import { expect, vi } from "vitest";
globalThis.expect = expect;
globalThis.vi = vi;

// Dynamic import to ensure expect is available first
import("@testing-library/jest-dom");