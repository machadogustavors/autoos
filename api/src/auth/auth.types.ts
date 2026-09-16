// Claim mínimo do accessToken (RF-01/RF-02). V1 tem um papel só — sem
// `role` aqui de propósito (ver CurrentUserPayload e docs/SPEC.md §6.4).
export interface JwtPayload {
  sub: string; // userId
}

export interface GoogleIdentity {
  email: string;
  googleSub: string;
  name?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
