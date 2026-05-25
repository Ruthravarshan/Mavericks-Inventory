import { Request, Response, NextFunction } from "express";

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error_code: "UNAUTHORIZED",
        message: "Authentication required",
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error_code: "FORBIDDEN",
        message: `This action requires one of the following roles: ${roles.join(", ")}`,
      });
      return;
    }

    next();
  };
}
