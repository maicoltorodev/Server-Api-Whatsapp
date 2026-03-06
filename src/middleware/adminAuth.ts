import config from '../config';
import { Request, Response, NextFunction } from 'express';

// Middleware para validar el acceso al Dashboard Administrativo
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey || apiKey !== config.ADMIN_API_KEY) {
    return res.status(401).json({
      status: 'error',
      message: 'No autorizado. Se requiere un API_KEY válido de Administrador.',
    });
  }

  next();
}

export default adminAuth;

