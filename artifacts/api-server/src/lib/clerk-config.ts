const PUBLISHABLE_KEY_RE = /^pk_(test|live)_[A-Za-z0-9]{16,}$/;
const SECRET_KEY_RE = /^sk_(test|live)_[A-Za-z0-9]{16,}$/;

export function isLikelyValidClerkPublishableKey(value: string | undefined): boolean {
  if (!value) return false;
  return PUBLISHABLE_KEY_RE.test(value);
}

export function isLikelyValidClerkSecretKey(value: string | undefined): boolean {
  if (!value) return false;
  return SECRET_KEY_RE.test(value);
}

export function shouldEnableClerkAuth(env: NodeJS.ProcessEnv): boolean {
  return isLikelyValidClerkPublishableKey(env.CLERK_PUBLISHABLE_KEY) && isLikelyValidClerkSecretKey(env.CLERK_SECRET_KEY);
}
