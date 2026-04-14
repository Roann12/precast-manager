// File overview: API client behavior and request/response handling for api/unauthorized.ts.
type UnauthorizedHandler = (message?: string) => void;

let handler: UnauthorizedHandler | null = null;

// Inputs: caller state/arguments related to set unauthorized handler.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  handler = fn;
}

// Inputs: caller state/arguments related to notify unauthorized.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export function notifyUnauthorized(message?: string) {
  handler?.(message);
}
