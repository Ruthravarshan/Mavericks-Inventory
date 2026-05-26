import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET ?? "fallback-dev-secret-change-in-prod";
const ACCESS_EXPIRY = "8h";
const REFRESH_EXPIRY = "8h";

export interface JwtPayload {
  id: number;
  email: string;
  role: string;
  name: string;
  iat?: number;
  exp?: number;
}

export function sign(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: ACCESS_EXPIRY,
  } as jwt.SignOptions);
}

export function signRefresh(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: REFRESH_EXPIRY,
  } as jwt.SignOptions);
}

export function verify(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
