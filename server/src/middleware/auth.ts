import { Request, Response, NextFunction } from 'express';
import { AuthService, UserPayload } from '../services/authService';

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ success: false, error: 'Authorization header required' });
    return;
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const user = AuthService.verifyToken(token);

  if (!user) {
    res.status(403).json({ success: false, error: 'Invalid or expired token' });
    return;
  }

  req.user = user;
  next();
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const user = AuthService.verifyToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}

export function requireRole(allowedRoles: Array<'student' | 'admin' | 'driver'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Forbidden: Insufficient privileges' });
      return;
    }

    next();
  };
}
