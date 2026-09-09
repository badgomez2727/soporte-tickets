import { Router } from 'express';
import { asyncHandler } from '../../shared/async-handler.js';
import { live, ready } from './health.controller.js';

export const healthRoutes = Router();

healthRoutes.get('/', live);
healthRoutes.get('/ready', asyncHandler(async (req, res) => ready(req, res)));
