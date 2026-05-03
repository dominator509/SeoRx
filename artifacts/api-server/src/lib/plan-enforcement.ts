import type { Request, Response, NextFunction } from "express";

export function enforceClientLimit() {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    next();
  };
}

export function enforceAuditLimit() {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    next();
  };
}

export function enforceAiLimit() {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    next();
  };
}
