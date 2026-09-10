-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('administrador', 'agente', 'supervisor');

-- CreateEnum
CREATE TYPE "EstadoTicket" AS ENUM ('nuevo', 'asignado', 'en_progreso', 'en_espera_cliente', 'resuelto', 'cerrado', 'reabierto');

-- CreateEnum
CREATE TYPE "PrioridadTicket" AS ENUM ('baja', 'media', 'alta', 'critica');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" "EstadoTicket" NOT NULL DEFAULT 'nuevo',
    "prioridad" "PrioridadTicket" NOT NULL,
    "cliente_id" UUID NOT NULL,
    "agente_id" UUID,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,
    "fecha_resolucion" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_asignaciones" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "agente_id" UUID NOT NULL,
    "asignado_por_id" UUID,
    "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_asignaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentarios" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "tickets_estado_fecha_actualizacion_idx" ON "tickets"("estado", "fecha_actualizacion");

-- CreateIndex
CREATE INDEX "tickets_prioridad_cliente_id_idx" ON "tickets"("prioridad", "cliente_id");

-- CreateIndex
CREATE INDEX "tickets_cliente_id_idx" ON "tickets"("cliente_id");

-- CreateIndex
CREATE INDEX "tickets_agente_id_idx" ON "tickets"("agente_id");

-- CreateIndex
CREATE INDEX "tickets_fecha_creacion_idx" ON "tickets"("fecha_creacion");

-- CreateIndex
CREATE INDEX "historial_asignaciones_ticket_id_idx" ON "historial_asignaciones"("ticket_id");

-- CreateIndex
CREATE INDEX "comentarios_ticket_id_idx" ON "comentarios"("ticket_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_agente_id_fkey" FOREIGN KEY ("agente_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_asignaciones" ADD CONSTRAINT "historial_asignaciones_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_asignaciones" ADD CONSTRAINT "historial_asignaciones_agente_id_fkey" FOREIGN KEY ("agente_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_asignaciones" ADD CONSTRAINT "historial_asignaciones_asignado_por_id_fkey" FOREIGN KEY ("asignado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
