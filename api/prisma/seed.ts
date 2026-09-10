// Datos de prueba para que las 8 consultas de queries.sql devuelvan resultados
// no vacíos. Cada bloque de tickets tiene un comentario diciendo qué consulta
// está pensado para satisfacer — ver README.md > "El seed usa SQL crudo en un
// punto" para la explicación de por qué hay una parte con $executeRaw.
import { PrismaClient, PrioridadTicket, RolUsuario } from '@prisma/client';

const prisma = new PrismaClient();

// Momento de referencia único: todas las fechas relativas del seed se calculan
// desde aquí, para que sean consistentes entre sí sin importar cuánto tarde
// el script en correr.
const ahora = new Date();

function diasAtras(dias: number, horasExtra = 0): Date {
  return new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000 - horasExtra * 60 * 60 * 1000);
}

// Todavía no existe el módulo de autenticación (es la siguiente tarea). Este
// valor es un placeholder explícito, no un hash real. Cuando se construya el
// login, agregar una librería de hashing (bcrypt/argon2) es una decisión de
// dependencia que se propone entonces, no aquí.
const PASSWORD_HASH_PLACEHOLDER = 'seed-sin-hash-real-pendiente-modulo-auth';

async function limpiar() {
  // Orden inverso a las llaves foráneas: hijos antes que padres.
  await prisma.comentario.deleteMany();
  await prisma.historialAsignacion.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.cliente.deleteMany();
}

async function crearClientes() {
  const [acme, logicorp, andina, norte, cafeDelValle] = await Promise.all([
    prisma.cliente.create({ data: { nombre: 'Acme Telecom' } }),
    prisma.cliente.create({ data: { nombre: 'LogiCorp' } }),
    prisma.cliente.create({ data: { nombre: 'Andina Salud' } }),
    prisma.cliente.create({ data: { nombre: 'Norte Textil' } }),
    prisma.cliente.create({ data: { nombre: 'Café del Valle' } }),
  ]);
  return { acme, logicorp, andina, norte, cafeDelValle };
}

async function crearUsuarios() {
  const admin1 = await prisma.usuario.create({
    data: {
      nombre: 'Marcela Restrepo',
      email: 'admin@infinivirt.test',
      passwordHash: PASSWORD_HASH_PLACEHOLDER,
      rol: RolUsuario.administrador,
    },
  });
  const supervisor1 = await prisma.usuario.create({
    data: {
      nombre: 'Julián Zapata',
      email: 'supervisor@infinivirt.test',
      passwordHash: PASSWORD_HASH_PLACEHOLDER,
      rol: RolUsuario.supervisor,
    },
  });
  const agente1 = await prisma.usuario.create({
    data: {
      nombre: 'Laura Gómez',
      email: 'agente1@infinivirt.test',
      passwordHash: PASSWORD_HASH_PLACEHOLDER,
      rol: RolUsuario.agente,
    },
  });
  const agente2 = await prisma.usuario.create({
    data: {
      nombre: 'Carlos Ruiz',
      email: 'agente2@infinivirt.test',
      passwordHash: PASSWORD_HASH_PLACEHOLDER,
      rol: RolUsuario.agente,
    },
  });
  const agente3 = await prisma.usuario.create({
    data: {
      nombre: 'Diana Torres',
      email: 'agente3@infinivirt.test',
      passwordHash: PASSWORD_HASH_PLACEHOLDER,
      rol: RolUsuario.agente,
    },
  });
  // Bloqueado: activo=false. Sirve para probar el filtro de login cuando
  // exista el módulo de auth, y para que "usuarios inactivos" no sea un caso
  // vacío en las pruebas de ese módulo.
  const agente4Bloqueado = await prisma.usuario.create({
    data: {
      nombre: 'Andrés Pineda',
      email: 'agente4@infinivirt.test',
      passwordHash: PASSWORD_HASH_PLACEHOLDER,
      rol: RolUsuario.agente,
      activo: false,
    },
  });

  return { admin1, supervisor1, agente1, agente2, agente3, agente4Bloqueado };
}

async function main() {
  await limpiar();

  const { acme, logicorp, andina, norte, cafeDelValle } = await crearClientes();
  const { admin1, supervisor1, agente1, agente2, agente3 } = await crearUsuarios();

  // --- Tickets -------------------------------------------------------------
  // T1: nuevo, sin agente todavía, recién creado. No debe aparecer en la
  // consulta 3 (no lleva 48h sin tocarse).
  const t1 = await prisma.ticket.create({
    data: {
      titulo: 'No hay tono en extensión 105',
      descripcion: 'El usuario reporta que la extensión 105 no genera tono de marcado desde esta mañana.',
      estado: 'nuevo',
      prioridad: PrioridadTicket.baja,
      clienteId: acme.id,
      fechaCreacion: diasAtras(0, 2),
    },
  });

  // T2: asignado, sin tocar hace 3 días -> consulta 3. prioridad media.
  const t2 = await prisma.ticket.create({
    data: {
      titulo: 'Caídas intermitentes en troncal SIP principal',
      descripcion: 'La troncal SIP con el proveedor principal se cae varias veces al día, cortando llamadas activas.',
      estado: 'asignado',
      prioridad: PrioridadTicket.media,
      clienteId: logicorp.id,
      agenteId: agente2.id,
      fechaCreacion: diasAtras(5),
    },
  });

  // T3: en_progreso, sin tocar hace 4 días -> consulta 3. prioridad alta -> consulta 2.
  const t3 = await prisma.ticket.create({
    data: {
      titulo: 'Latencia alta en llamadas VoIP entre sedes',
      descripcion: 'Las llamadas entre la sede norte y la sede sur tienen latencia audible y cortes de audio.',
      estado: 'en_progreso',
      prioridad: PrioridadTicket.alta,
      clienteId: andina.id,
      agenteId: agente1.id,
      fechaCreacion: diasAtras(10),
    },
  });

  // T4: en_espera_cliente, sin tocar hace 5 días -> consulta 3. prioridad critica -> consulta 2.
  const t4 = await prisma.ticket.create({
    data: {
      titulo: 'Central telefónica no registra extensiones nuevas',
      descripcion: 'Se necesita acceso remoto del cliente para revisar el registro SIP de las extensiones agregadas.',
      estado: 'en_espera_cliente',
      prioridad: PrioridadTicket.critica,
      clienteId: norte.id,
      agenteId: agente3.id,
      fechaCreacion: diasAtras(20),
    },
  });

  // T5, T5b, T5c: resuelto, con fecha_resolucion dentro del último mes -> consultas 4 y 5.
  const t5 = await prisma.ticket.create({
    data: {
      titulo: 'Audio unidireccional en llamadas salientes',
      descripcion: 'Las llamadas salientes se conectan pero el destino no escucha al agente.',
      estado: 'resuelto',
      prioridad: PrioridadTicket.alta,
      clienteId: cafeDelValle.id,
      agenteId: agente2.id,
      fechaCreacion: diasAtras(25),
      fechaResolucion: diasAtras(10),
    },
  });
  const t5b = await prisma.ticket.create({
    data: {
      titulo: 'Buzón de voz no envía notificación por correo',
      descripcion: 'Los mensajes de voz llegan al buzón pero no se envía la notificación configurada por correo.',
      estado: 'resuelto',
      prioridad: PrioridadTicket.media,
      clienteId: logicorp.id,
      agenteId: agente1.id,
      fechaCreacion: diasAtras(20),
      fechaResolucion: diasAtras(15),
    },
  });
  const t5c = await prisma.ticket.create({
    data: {
      titulo: 'Configurar horario de atención en IVR',
      descripcion: 'Se solicita ajustar el horario de atención del IVR principal a la nueva jornada del cliente.',
      estado: 'resuelto',
      prioridad: PrioridadTicket.baja,
      clienteId: norte.id,
      agenteId: agente2.id,
      fechaCreacion: diasAtras(12),
      fechaResolucion: diasAtras(5),
    },
  });

  // T6, T7: cerrado, creados y cerrados dentro de los últimos 30 días -> consulta 8.
  const t6 = await prisma.ticket.create({
    data: {
      titulo: 'Grabación de llamadas no se está generando',
      descripcion: 'El módulo de grabación dejó de generar archivos desde el último reinicio del servidor.',
      estado: 'cerrado',
      prioridad: PrioridadTicket.media,
      clienteId: acme.id,
      agenteId: agente1.id,
      fechaCreacion: diasAtras(15),
      fechaResolucion: diasAtras(8),
    },
  });
  const t7 = await prisma.ticket.create({
    data: {
      titulo: 'Solicitud de nueva extensión para colaborador',
      descripcion: 'Se solicita crear la extensión 212 para un colaborador nuevo del área comercial.',
      estado: 'cerrado',
      prioridad: PrioridadTicket.critica,
      clienteId: logicorp.id,
      agenteId: agente2.id,
      fechaCreacion: diasAtras(12),
      fechaResolucion: diasAtras(6),
    },
  });

  // T8: nuevo, creado hace poco -> aporta al denominador de la consulta 8
  // sin ser cerrado, para que el porcentaje no salga en 100%.
  const t8 = await prisma.ticket.create({
    data: {
      titulo: 'Eco en llamadas desde extensión de gerencia',
      descripcion: 'Se reporta eco perceptible en llamadas salientes desde la extensión de gerencia general.',
      estado: 'nuevo',
      prioridad: PrioridadTicket.media,
      clienteId: norte.id,
      agenteId: agente1.id,
      fechaCreacion: diasAtras(3),
    },
  });

  // T9: en_progreso, reasignado 3 veces (4 filas de historial) -> consulta 7.
  const t9 = await prisma.ticket.create({
    data: {
      titulo: 'Cola de llamadas no distribuye equitativamente',
      descripcion: 'Los agentes de la cola de soporte reportan que un compañero recibe muchas más llamadas que el resto.',
      estado: 'en_progreso',
      prioridad: PrioridadTicket.alta,
      clienteId: andina.id,
      agenteId: agente1.id,
      fechaCreacion: diasAtras(6),
    },
  });

  // T10: asignado, reasignado 4 veces (5 filas de historial) -> consulta 7.
  const t10 = await prisma.ticket.create({
    data: {
      titulo: 'Falla en enrutamiento de llamadas entrantes internacionales',
      descripcion: 'Las llamadas entrantes desde números internacionales no se están enrutando al IVR configurado.',
      estado: 'asignado',
      prioridad: PrioridadTicket.critica,
      clienteId: cafeDelValle.id,
      agenteId: agente3.id,
      fechaCreacion: diasAtras(8),
    },
  });

  // T11: cerrado, pero creado hace 60 días -> queda FUERA de la ventana de
  // 30 días de la consulta 8. Está a propósito, para que el filtro por
  // fecha se vea funcionando (si todos los tickets cayeran dentro de la
  // ventana, no se notaría si el WHERE realmente filtra algo).
  const t11 = await prisma.ticket.create({
    data: {
      titulo: 'Migración de numeración a nuevo proveedor',
      descripcion: 'Migración completa de la numeración del cliente hacia el nuevo proveedor de troncales.',
      estado: 'cerrado',
      prioridad: PrioridadTicket.alta,
      clienteId: logicorp.id,
      agenteId: agente3.id,
      fechaCreacion: diasAtras(60),
      fechaResolucion: diasAtras(55),
    },
  });

  // T12: reabierto. Estuvo resuelto y se reabrió, por eso fecha_resolucion
  // vuelve a null (ver README > Supuestos, nota sobre "reabierto"). Sin
  // tocar hace 4 días -> también aporta a la consulta 3.
  const t12 = await prisma.ticket.create({
    data: {
      titulo: 'Corte total de servicio en sede principal',
      descripcion: 'El cliente reporta que el corte que se había dado por resuelto volvió a presentarse en la sede principal.',
      estado: 'reabierto',
      prioridad: PrioridadTicket.alta,
      clienteId: acme.id,
      agenteId: agente1.id,
      fechaCreacion: diasAtras(18),
      fechaResolucion: null,
    },
  });

  // --- Historial de asignaciones --------------------------------------------
  // Una fila por evento de asignación, incluida la primera (ver README).
  await prisma.historialAsignacion.createMany({
    data: [
      { ticketId: t2.id, agenteId: agente2.id, asignadoPorId: supervisor1.id, fechaAsignacion: diasAtras(5) },
      { ticketId: t3.id, agenteId: agente1.id, asignadoPorId: supervisor1.id, fechaAsignacion: diasAtras(10) },
      { ticketId: t4.id, agenteId: agente3.id, asignadoPorId: admin1.id, fechaAsignacion: diasAtras(20) },
      { ticketId: t5.id, agenteId: agente2.id, asignadoPorId: supervisor1.id, fechaAsignacion: diasAtras(25) },
      { ticketId: t5b.id, agenteId: agente1.id, asignadoPorId: supervisor1.id, fechaAsignacion: diasAtras(20) },
      { ticketId: t5c.id, agenteId: agente2.id, asignadoPorId: supervisor1.id, fechaAsignacion: diasAtras(12) },
      { ticketId: t6.id, agenteId: agente1.id, asignadoPorId: supervisor1.id, fechaAsignacion: diasAtras(15) },
      { ticketId: t7.id, agenteId: agente2.id, asignadoPorId: admin1.id, fechaAsignacion: diasAtras(12) },
      // Autoasignación al crearse: asignadoPorId null.
      { ticketId: t8.id, agenteId: agente1.id, asignadoPorId: null, fechaAsignacion: diasAtras(3) },
      { ticketId: t11.id, agenteId: agente3.id, asignadoPorId: supervisor1.id, fechaAsignacion: diasAtras(60) },
      { ticketId: t12.id, agenteId: agente1.id, asignadoPorId: supervisor1.id, fechaAsignacion: diasAtras(18) },

      // T9: 4 filas -> 3 reasignaciones (COUNT(h.id) - 1). Termina en agente1,
      // que es quien quedó como agenteId actual del ticket.
      { ticketId: t9.id, agenteId: agente1.id, asignadoPorId: null, fechaAsignacion: diasAtras(6) },
      { ticketId: t9.id, agenteId: agente2.id, asignadoPorId: supervisor1.id, fechaAsignacion: diasAtras(5) },
      { ticketId: t9.id, agenteId: agente3.id, asignadoPorId: supervisor1.id, fechaAsignacion: diasAtras(4) },
      { ticketId: t9.id, agenteId: agente1.id, asignadoPorId: admin1.id, fechaAsignacion: diasAtras(2) },

      // T10: 5 filas -> 4 reasignaciones. Termina en agente3.
      { ticketId: t10.id, agenteId: agente2.id, asignadoPorId: null, fechaAsignacion: diasAtras(8) },
      { ticketId: t10.id, agenteId: agente3.id, asignadoPorId: supervisor1.id, fechaAsignacion: diasAtras(7) },
      { ticketId: t10.id, agenteId: agente1.id, asignadoPorId: supervisor1.id, fechaAsignacion: diasAtras(6) },
      { ticketId: t10.id, agenteId: agente2.id, asignadoPorId: admin1.id, fechaAsignacion: diasAtras(4) },
      { ticketId: t10.id, agenteId: agente3.id, asignadoPorId: supervisor1.id, fechaAsignacion: diasAtras(1) },
    ],
  });

  // --- Comentarios -----------------------------------------------------------
  await prisma.comentario.createMany({
    data: [
      { ticketId: t2.id, usuarioId: agente2.id, cuerpo: 'Se revisó el proveedor de la troncal, hay reportes similares de otros clientes. Escalado a nivel 2.', fechaCreacion: diasAtras(4) },
      { ticketId: t2.id, usuarioId: supervisor1.id, cuerpo: 'Confirmar con el proveedor el tiempo estimado de resolución y comunicarlo al cliente.', fechaCreacion: diasAtras(3) },
      { ticketId: t3.id, usuarioId: agente1.id, cuerpo: 'Se detectó congestión en el enlace entre sedes en horario pico. Se propone QoS dedicado para VoIP.', fechaCreacion: diasAtras(9) },
      { ticketId: t5.id, usuarioId: agente2.id, cuerpo: 'Se reconfiguró el codec de la troncal saliente. Cliente confirma audio bidireccional restablecido.', fechaCreacion: diasAtras(10) },
      { ticketId: t9.id, usuarioId: agente3.id, cuerpo: 'Se ajustó el algoritmo de distribución de la cola, se deja en observación.', fechaCreacion: diasAtras(3) },
      { ticketId: t9.id, usuarioId: agente1.id, cuerpo: 'Sigue habiendo desbalance, tomo el caso de nuevo para revisar configuración del ACD.', fechaCreacion: diasAtras(2) },
      { ticketId: t10.id, usuarioId: agente3.id, cuerpo: 'Se corrigió la ruta de entrada internacional en el dial plan. Pendiente validar con el cliente.', fechaCreacion: diasAtras(1) },
    ],
  });

  // --- Forzar fecha_actualizacion con SQL crudo -------------------------------
  // fechaActualizacion tiene @updatedAt: Prisma la sobreescribe con la fecha
  // actual en cada escritura desde el cliente, así que no hay forma de fijarla
  // en el pasado con prisma.ticket.create()/update(). Para que estos tickets
  // aparezcan en la consulta 3 (más de 48h sin actualizarse) hay que saltarse
  // el cliente de Prisma y escribir la columna directamente. Ver README para
  // la justificación completa de por qué el seed usa SQL crudo en este punto.
  const actualizacionesForzadas: Array<{ id: string; fecha: Date }> = [
    { id: t2.id, fecha: diasAtras(3) },
    { id: t3.id, fecha: diasAtras(4) },
    { id: t4.id, fecha: diasAtras(5) },
    { id: t12.id, fecha: diasAtras(4) },
  ];

  for (const { id, fecha } of actualizacionesForzadas) {
    await prisma.$executeRaw`UPDATE tickets SET fecha_actualizacion = ${fecha} WHERE id = ${id}::uuid`;
  }

  console.log('Seed cargado:');
  console.log('  5 clientes, 6 usuarios (1 inactivo), 14 tickets');
  console.log('  20 filas de historial de asignaciones, 7 comentarios');
  console.log('  4 tickets forzados a >48h sin actualizar vía SQL crudo');
}

main()
  .catch((error) => {
    console.error('Error cargando el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
