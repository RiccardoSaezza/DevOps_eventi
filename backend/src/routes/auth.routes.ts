import { Router } from 'express';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { loginSchema, registerSchema } from '../schemas/auth.schema.js';
import { findUserById, login, register } from '../services/auth.service.js';
import { parseBody } from '../utils/validate.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const input = parseBody(registerSchema, req.body);
  const result = await register(input);
  res.status(201).json(result);
});

authRouter.post('/login', async (req, res) => {
  const input = parseBody(loginSchema, req.body);
  const result = await login(input);
  res.status(200).json(result);
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await findUserById(currentUser(req).id);
  res.status(200).json({ user });
});
