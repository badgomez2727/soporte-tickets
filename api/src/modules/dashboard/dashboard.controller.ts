import type { Request, Response } from 'express';
import * as dashboardService from './dashboard.service.js';

export async function ticketsPorClienteYEstadoController(_req: Request, res: Response) {
  res.json(await dashboardService.ticketsPorClienteYEstado());
}

export async function topClientesPrioridadAltaController(_req: Request, res: Response) {
  res.json(await dashboardService.topClientesPrioridadAlta());
}

export async function ticketsSinActualizarController(_req: Request, res: Response) {
  res.json(await dashboardService.ticketsSinActualizar());
}

export async function agenteMasResuelveMesController(_req: Request, res: Response) {
  res.json(await dashboardService.agenteMasResuelveMes());
}

export async function tiempoPromedioResolucionController(_req: Request, res: Response) {
  res.json(await dashboardService.tiempoPromedioResolucion());
}

export async function ticketsAbiertosPorAgenteController(_req: Request, res: Response) {
  res.json(await dashboardService.ticketsAbiertosPorAgente());
}

export async function ticketsReasignadosFrecuentesController(_req: Request, res: Response) {
  res.json(await dashboardService.ticketsReasignadosFrecuentes());
}

export async function porcentajeCerrados30DiasController(_req: Request, res: Response) {
  res.json(await dashboardService.porcentajeCerrados30Dias());
}

export async function totalAbiertosController(_req: Request, res: Response) {
  res.json(await dashboardService.totalAbiertos());
}

export async function ticketsAgentesInactivosController(_req: Request, res: Response) {
  res.json(await dashboardService.ticketsAgentesInactivos());
}
