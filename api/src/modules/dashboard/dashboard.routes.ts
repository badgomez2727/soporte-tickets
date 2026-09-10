import { Router } from 'express';
import { asyncHandler } from '../../shared/async-handler.js';
import { autenticar } from '../../shared/middleware/autenticar.js';
import { autorizarRol } from '../../shared/middleware/autorizar-rol.js';
import {
  agenteMasResuelveMesController,
  porcentajeCerrados30DiasController,
  ticketsAbiertosPorAgenteController,
  ticketsAgentesInactivosController,
  ticketsPorClienteYEstadoController,
  ticketsReasignadosFrecuentesController,
  ticketsSinActualizarController,
  tiempoPromedioResolucionController,
  topClientesPrioridadAltaController,
  totalAbiertosController,
} from './dashboard.controller.js';

export const dashboardRoutes = Router();

// Dashboard de métricas: Administrador y Supervisor. La propia consulta 3
// de queries.sql ya venía documentada como "usada por el rol Supervisor";
// un Agente no la necesita para su trabajo del día a día.
dashboardRoutes.use(autenticar, autorizarRol('administrador', 'supervisor'));

dashboardRoutes.get('/tickets-por-cliente-y-estado', asyncHandler(ticketsPorClienteYEstadoController));
dashboardRoutes.get('/top-clientes-prioridad-alta', asyncHandler(topClientesPrioridadAltaController));
dashboardRoutes.get('/tickets-sin-actualizar', asyncHandler(ticketsSinActualizarController));
dashboardRoutes.get('/agente-mas-resuelve-mes', asyncHandler(agenteMasResuelveMesController));
dashboardRoutes.get('/tiempo-promedio-resolucion', asyncHandler(tiempoPromedioResolucionController));
dashboardRoutes.get('/tickets-abiertos-por-agente', asyncHandler(ticketsAbiertosPorAgenteController));
dashboardRoutes.get('/tickets-reasignados-frecuentes', asyncHandler(ticketsReasignadosFrecuentesController));
dashboardRoutes.get('/porcentaje-cerrados-30-dias', asyncHandler(porcentajeCerrados30DiasController));
dashboardRoutes.get('/total-abiertos', asyncHandler(totalAbiertosController));
dashboardRoutes.get('/tickets-agentes-inactivos', asyncHandler(ticketsAgentesInactivosController));
