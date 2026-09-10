import { prisma } from '../../shared/prisma.js';

// Lista mínima (id + nombre): la necesita el frontend para el selector de
// cliente al crear un ticket y para el filtro del listado. No hay CRUD de
// clientes en el enunciado — este es el único endpoint que existe sobre
// el modelo Cliente, agregado porque el formulario de creación de tickets
// no puede funcionar sin una forma de elegir el cliente (ver README).
export async function listar() {
  return prisma.cliente.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });
}
