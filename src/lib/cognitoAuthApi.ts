/**
 * JOBMATCHER-RIS-COGNITO-INTEGRATION-04 — Cognito self-service API.
 *
 * Ruft die Cognito-User-Pool-Operationen SignUp, ConfirmSignUp und
 * ResendConfirmationCode als dokumentierte unauthentifizierte Operationen
 * direkt über global fetch() auf (AWS-JSON-1.1-RPC, X-Amz-Target-Header).
 * Kein AWS-SDK, kein Amplify, keine neue Abhängigkeit, kein serverseitiger
 * Proxy, keine AWS-Credentials im Browser (AGENTS.md: "prefer global fetch").
 *
 * Sicherheitsregeln:
 * - Passwörter, Bestätigungscodes und Tokens werden NIE geloggt.
 * - Es fließen ausschließlich der public Client-ID und die Region.
 * - Fehler werden typisiert gemappt (Codes ohne sensible Inhalte).
 */

import { REGION, CLIENT_ID } from "./oidcConfig";

const COGNITO_ENDPOINT = `https://cognito-idp.${REGION}.amazonaws.com/`;

export type CognitoAuthErrorCode =
  | "user-exists"
  | "invalid-password"
  | "invalid-parameter"
  | "code-mismatch"
  | "code-expired"
  | "too-many-requests"
  | "limit-exceeded"
  | "not-authorized"
  | "network"
  | "config"
  | "unknown";

export class CognitoAuthError extends Error {
  code: CognitoAuthErrorCode;
  constructor(code: CognitoAuthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

interface CognitoRpcException {
  code?: string;
  message?: string;
}

function mapException(exc: CognitoRpcException, httpStatus: number): CognitoAuthError {
  switch (exc.code) {
    case "UsernameExistsException":
      return new CognitoAuthError("user-exists", exc.message || "user exists");
    case "InvalidPasswordException":
      return new CognitoAuthError("invalid-password", exc.message || "password policy violated");
    case "CodeMismatchException":
      return new CognitoAuthError("code-mismatch", exc.message || "code mismatch");
    case "ExpiredCodeException":
      return new CognitoAuthError("code-expired", exc.message || "code expired");
    case "LimitExceededException":
      return new CognitoAuthError("limit-exceeded", exc.message || "limit exceeded");
    case "TooManyRequestsException":
      return new CognitoAuthError("too-many-requests", exc.message || "too many requests");
    case "NotAuthorizedException":
      return new CognitoAuthError("not-authorized", exc.message || "not authorized");
    case "InvalidParameterException":
      return new CognitoAuthError("invalid-parameter", exc.message || "invalid parameter");
    default:
      // Nie den rohen Cognito-Message-Text durchreichen (könnte Interna enthalten);
      // nur der HTTP-Status ist für die Oberfläche relevant.
      return httpStatus === 400
        ? new CognitoAuthError("invalid-parameter", "bad request")
        : new CognitoAuthError("unknown", "unexpected error");
  }
}

async function cognitoRpc<T>(operation: string, payload: Record<string, unknown>): Promise<T> {
  if (!CLIENT_ID || !REGION) {
    throw new CognitoAuthError("config", "Cognito configuration missing");
  }
  let response: Response;
  try {
    response = await fetch(COGNITO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": `AWSCognitoIdentityProviderService.${operation}`,
      },
      body: JSON.stringify({ ClientId: CLIENT_ID, ...payload }),
    });
  } catch {
    throw new CognitoAuthError("network", "network request failed");
  }
  const text = await response.text();
  if (!response.ok) {
    let exc: CognitoRpcException = {};
    try {
      exc = JSON.parse(text) as CognitoRpcException;
    } catch {
      // nicht-JSON-Antwort: unbekannter Fehler ohne Inhaltsweitergabe
    }
    throw mapException(exc, response.status);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new CognitoAuthError("unknown", "invalid response body");
  }
}

export interface SignUpResult {
  userSub: string;
  confirmed: boolean;
}

export async function cognitoSignUp(input: {
  username: string;
  password: string;
  email: string;
}): Promise<SignUpResult> {
  const result = await cognitoRpc<{ UserSub?: string; UserConfirmed?: boolean }>("SignUp", {
    Username: input.username,
    Password: input.password,
    UserAttributes: [{ Name: "email", Value: input.email }],
  });
  // Passwort wird nach dem Call nirgends referenziert oder geloggt.
  return { userSub: result.UserSub || "", confirmed: Boolean(result.UserConfirmed) };
}

export async function cognitoConfirmSignUp(input: {
  username: string;
  code: string;
}): Promise<void> {
  await cognitoRpc("ConfirmSignUp", {
    Username: input.username,
    ConfirmationCode: input.code,
  });
}

export async function cognitoResendConfirmationCode(input: {
  username: string;
}): Promise<void> {
  await cognitoRpc("ResendConfirmationCode", { Username: input.username });
}
