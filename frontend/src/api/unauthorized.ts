type UnauthorizedHandler = (message?: string) => void;

let handler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  handler = fn;
}

export function notifyUnauthorized(message?: string) {
  handler?.(message);
}
