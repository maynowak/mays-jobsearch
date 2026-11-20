/**
 * Internal Node Lambda handler for the RIS analysis agent.
 *
 * Invoked synchronously by the dedicated analysis runtime (no public HTTP
 * endpoint). Reuses the exact same parser entry point as the CLI.
 *
 * Event:  { capability: "parse.cv"|"parse.job"|"parse.ats", input: {...} }
 * Result: the parser envelope, or {schemaVersion, error:{code,message}}.
 */
import { runParser } from "../scripts/ris-parser-cli.mjs";

export async function handler(event) {
  try {
    return await runParser(event?.capability, event?.input);
  } catch (error) {
    return {
      schemaVersion: "1.0",
      error: {
        code: error?.code || "internal_error",
        message: error?.message || "parser failed",
      },
    };
  }
}
