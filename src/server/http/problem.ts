import { NextResponse } from "next/server";

// RFC 9457 problem details with stable application codes and a request ID
// (spec/07). Messages must be safe: no narrative content, no existence hints.

const PROBLEM_BASE = "https://oportfolio.example/problems";

export type ProblemCode =
  | "not-found"
  | "unauthenticated"
  | "validation-failed"
  | "conflict"
  | "precondition-required"
  | "invalid-state"
  | "rate-limited"
  | "upload-policy"
  | "internal";

const STATUS_BY_CODE: Record<ProblemCode, number> = {
  "not-found": 404,
  unauthenticated: 401,
  "validation-failed": 422,
  conflict: 412,
  "precondition-required": 428,
  "invalid-state": 409,
  "rate-limited": 429,
  "upload-policy": 422,
  internal: 500,
};

const TITLE_BY_CODE: Record<ProblemCode, string> = {
  "not-found": "Not found",
  unauthenticated: "Sign in required",
  "validation-failed": "Validation failed",
  conflict: "The item was changed elsewhere",
  "precondition-required": "Missing If-Match header",
  "invalid-state": "Action not available",
  "rate-limited": "Too many requests",
  "upload-policy": "File not accepted",
  internal: "Something went wrong",
};

export interface ProblemExtras {
  detail?: string;
  errors?: Array<{ pointer: string; message: string }>;
  [key: string]: unknown;
}

export function problem(
  code: ProblemCode,
  requestId: string,
  extras: ProblemExtras = {},
): NextResponse {
  const status = STATUS_BY_CODE[code];
  return NextResponse.json(
    {
      type: `${PROBLEM_BASE}/${code}`,
      title: TITLE_BY_CODE[code],
      status,
      code,
      requestId,
      ...extras,
    },
    {
      status,
      headers: { "Content-Type": "application/problem+json" },
    },
  );
}

// Authorization denials on object reads must be byte-identical to a plain
// not-found so object existence never leaks (spec/12, AC-01). Always route
// both through this helper.
export function notFoundProblem(requestId: string): NextResponse {
  return problem("not-found", requestId);
}
