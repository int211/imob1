import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_conectacorretor_dev_secret_2024";
const COOKIE_NAME = "cc_token";
const SALT_ROUNDS = 10;

export interface AuthPayload {
  brokerId: string;
  isAdmin: boolean;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export function setAuthCookie(res: Response, payload: AuthPayload): void {
  const token = signToken(payload);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, stored: string): Promise<boolean> {
  if (!stored.startsWith("$2")) {
    return plain === stored;
  }
  return bcrypt.compare(plain, stored);
}

export function hashPasswordSync(plain: string): string {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Autenticação necessária." });
    return;
  }
  try {
    const payload = verifyToken(token);
    (req as any).auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = (req as any).auth as AuthPayload | undefined;
  if (!auth) {
    res.status(401).json({ error: "Autenticação necessária." });
    return;
  }
  if (!auth.isAdmin) {
    res.status(403).json({ error: "Acesso restrito a administradores." });
    return;
  }
  next();
}
