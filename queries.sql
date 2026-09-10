-- queries.sql
--
-- 8 consultas analíticas sobre el modelo de soporte_tickets.
-- Corren directamente contra Postgres (no pasan por Prisma), por eso usan
-- los nombres de tabla/columna en snake_case tal como quedaron en la
-- migración (ver api/prisma/schema.prisma para el mapeo desde los nombres
-- camelCase del lado de la aplicación).
--
-- Varias consultas se corrigieron respecto al enunciado original — ver
-- README.md > Supuestos y > "Qué pasa con millones de registros" para la
-- justificación completa de cada una:
--   - Consulta 3, 6, 9: estado IN (<abiertos>) en vez de NOT IN ('cerrado','resuelto'),
--     por rendimiento del índice (ver "Qué pasa con millones de registros").
--   - Consulta 4: usa fecha_resolucion en vez de fecha_actualizacion.
--   - Consulta 7: cuenta reasignaciones (COUNT - 1), no asignaciones totales.

-- 1. Cantidad de tickets por estado para cada cliente.
SELECT
    c.id AS cliente_id,
    c.nombre AS cliente_nombre,
    t.estado,
    COUNT(t.id) AS cantidad_tickets
FROM clientes c
JOIN tickets t ON c.id = t.cliente_id
GROUP BY c.id, c.nombre, t.estado
ORDER BY c.nombre, t.estado;

-- 2. Los cinco clientes con mayor cantidad de tickets de prioridad alta o crítica.
SELECT
    c.id AS cliente_id,
    c.nombre AS cliente_nombre,
    COUNT(t.id) AS total_tickets_altos_criticos
FROM clientes c
JOIN tickets t ON c.id = t.cliente_id
WHERE t.prioridad IN ('alta', 'critica')
GROUP BY c.id, c.nombre
ORDER BY total_tickets_altos_criticos DESC
LIMIT 5;

-- 3. Tickets que llevan más de 48 horas sin actualización y no están cerrados
--    (usado por el rol Supervisor).
--    CORREGIDA respecto a la primera versión: se escribe como
--    estado IN (<estados abiertos>) en vez de estado NOT IN ('cerrado','resuelto').
--    Son equivalentes en resultado (7 estados en total, cerrado/resuelto son
--    los únicos 2 que no son "abiertos"), pero NO son equivalentes en
--    rendimiento: probado con EXPLAIN ANALYZE sobre 1 millón de filas, un
--    B-tree no puede usar "<> ALL (...)" (lo que genera NOT IN) como
--    condición de la columna líder de un índice compuesto — Postgres solo
--    puede filtrar por fecha_actualizacion y descarta el estado después de
--    leer. Con IN (lista positiva) sí arma la condición completa sobre las
--    dos columnas del índice tickets(estado, fecha_actualizacion) y lo usa
--    de forma natural. Ver README.md > "Qué pasa con millones de registros"
--    para el detalle completo de la medición.
SELECT
    t.id,
    t.titulo,
    t.estado,
    t.prioridad,
    t.fecha_actualizacion,
    u.nombre AS agente_asignado
FROM tickets t
LEFT JOIN usuarios u ON t.agente_id = u.id
WHERE t.estado IN ('nuevo', 'asignado', 'en_progreso', 'en_espera_cliente', 'reabierto')
  AND t.fecha_actualizacion < NOW() - INTERVAL '48 hours';

-- 4. Usuario con mayor cantidad de tickets resueltos durante el último mes.
--    CORREGIDA: el enunciado original filtraba por fecha_actualizacion, que
--    se toca con cualquier cambio al ticket (un comentario, una
--    reasignación), no solo al resolverlo. fecha_resolucion es la fecha de
--    negocio correcta para "cuándo se resolvió" — es la misma columna que
--    usa la consulta 5 para el mismo concepto.
SELECT
    u.id AS usuario_id,
    u.nombre AS usuario_nombre,
    COUNT(t.id) AS tickets_resueltos
FROM usuarios u
JOIN tickets t ON u.id = t.agente_id
WHERE t.estado = 'resuelto'
  AND t.fecha_resolucion >= NOW() - INTERVAL '1 month'
GROUP BY u.id, u.nombre
ORDER BY tickets_resueltos DESC
LIMIT 1;

-- 5. Tiempo promedio de resolución de tickets por prioridad, en horas.
--    Nota (ver README > Supuestos): no descuenta el tiempo en
--    en_espera_cliente, así que sobreestima el tiempo real de trabajo del
--    agente en tickets que pasaron por ese estado.
SELECT
    prioridad,
    AVG(EXTRACT(EPOCH FROM (fecha_resolucion - fecha_creacion)) / 3600) AS promedio_horas_resolucion
FROM tickets
WHERE estado IN ('resuelto', 'cerrado')
  AND fecha_resolucion IS NOT NULL
GROUP BY prioridad;

-- 6. Cantidad de tickets abiertos (no resueltos/cerrados) por agente.
--    CORREGIDA: estado IN (<abiertos>) en vez de NOT IN ('cerrado','resuelto'),
--    por la misma razón de rendimiento de índice documentada en la consulta 3.
SELECT
    u.id AS agente_id,
    u.nombre AS agente_nombre,
    COUNT(t.id) AS tickets_abiertos
FROM usuarios u
JOIN tickets t ON u.id = t.agente_id
WHERE t.estado IN ('nuevo', 'asignado', 'en_progreso', 'en_espera_cliente', 'reabierto')
GROUP BY u.id, u.nombre
ORDER BY tickets_abiertos DESC;

-- 7. Tickets reasignados más de dos veces (control de fricción operativa).
--    CORREGIDA: historial_asignaciones tiene una fila por cada evento de
--    asignación, incluida la primera (la asignación inicial no es una
--    "reasignación"). El número de reasignaciones es COUNT(h.id) - 1, no
--    COUNT(h.id) directamente.
SELECT
    t.id,
    t.titulo,
    COUNT(h.id) - 1 AS total_reasignaciones
FROM tickets t
JOIN historial_asignaciones h ON t.id = h.ticket_id
GROUP BY t.id, t.titulo
HAVING COUNT(h.id) - 1 > 2;

-- 8. Porcentaje de tickets cerrados frente al total de tickets creados en
--    los últimos 30 días.
SELECT
    COALESCE(
        COUNT(CASE WHEN estado = 'cerrado' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
        0
    ) AS porcentaje_cerrados
FROM tickets
WHERE fecha_creacion >= NOW() - INTERVAL '30 days';

-- 9. (Adicional dashboard) Total de tickets abiertos en el sistema.
--    CORREGIDA: estado IN (<abiertos>) en vez de NOT IN ('cerrado','resuelto'),
--    misma razón que la consulta 3 y la 6.
SELECT
    COUNT(*) AS total_abiertos
FROM tickets
WHERE estado IN ('nuevo', 'asignado', 'en_progreso', 'en_espera_cliente', 'reabierto');
