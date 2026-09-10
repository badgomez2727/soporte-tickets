# Rendimiento: el índice de la consulta 3 bajo `EXPLAIN ANALYZE`

Extraído de `README.md` como archivo aparte para mostrarlo directo en la
sustentación, sin tener que buscarlo dentro del README completo. El
contenido es el mismo; ver también `README.md` > "Qué pasa con millones de
registros" y `docs/uso-ia.md` para el registro de cómo se llegó a esto.

## La pregunta

`tickets(estado, fecha_actualizacion)` es un índice compuesto pensado para
la consulta 3 de `queries.sql` (tickets sin actualizar hace más de 48h, no
cerrados — la que usa el rol Supervisor). Declarar un índice en el schema
no garantiza que Postgres lo use: hay que medirlo. En vez de suponer que
funciona porque está en `schema.prisma`, se midió con `EXPLAIN ANALYZE`
sobre datos reales.

## Plan 1 — seed pequeño (14-15 filas)

```
Hash Left Join  (cost=21.93..41.73 rows=155 width=96) (actual time=0.150..0.156 rows=4 loops=1)
   Hash Cond: (t.agente_id = u.id)
   ->  Seq Scan on tickets t  (cost=0.00..19.40 rows=155 width=80) (actual time=0.053..0.056 rows=4 loops=1)
         Filter: ((estado <> ALL ('{cerrado,resuelto}'::"EstadoTicket"[])) AND (fecha_actualizacion < (now() - '48:00:00'::interval)))
         Rows Removed by Filter: 10
   ->  Hash  (cost=15.30..15.30 rows=530 width=48) (actual time=0.044..0.045 rows=6 loops=1)
         ->  Seq Scan on usuarios u  (cost=0.00..15.30 rows=530 width=48) (actual time=0.009..0.010 rows=6 loops=1)
 Planning Time: 9.460 ms
 Execution Time: 0.357 ms
```

**Seq Scan, no usa el índice — y Postgres tiene razón.** Con 14-15 filas la
tabla completa cabe en una sola página de 8kB; leerla entera es más barato
que el overhead de abrir un índice, buscar en él, y volver a la tabla por
cada fila (*heap fetch*). Cualquier índice sobre una tabla de este tamaño
es ruido. Esto es exactamente lo que hace que probar índices contra los
datos de demo sea inútil — hay que medir con volumen real.

## Plan 2 — 1 millón de filas, consulta original (`estado NOT IN (...)`)

Datos sintéticos insertados temporalmente (no el seed de la app) con
distribución realista: 65% resueltos/cerrados, y del resto solo ~8% con
más de 48h sin tocarse.

```
 Gather  (cost=1021.92..71792.08 rows=89772 width=97) (actual time=1.067..255.682 rows=79763 loops=1)
   Workers Planned: 2
   Workers Launched: 2
   ->  Hash Left Join  (cost=21.93..61814.88 rows=37405 width=97) (actual time=11.135..208.570 rows=26588 loops=3)
         Hash Cond: (t.agente_id = u.id)
         ->  Parallel Seq Scan on tickets t  (cost=0.00..61693.97 rows=37405 width=81) (actual time=9.948..196.859 rows=26588 loops=3)
               Filter: ((estado <> ALL ('{cerrado,resuelto}'::"EstadoTicket"[])) AND (fecha_actualizacion < (now() - '48:00:00'::interval)))
               Rows Removed by Filter: 306750
         ->  Hash  (cost=15.30..15.30 rows=530 width=48) (actual time=0.102..0.103 rows=6 loops=3)
               ->  Seq Scan on usuarios u  (cost=0.00..15.30 rows=530 width=48) (actual time=0.061..0.063 rows=6 loops=3)
 Planning Time: 5.963 ms
 Execution Time: 260.930 ms
```

**Sequential scan paralelo (2 workers) — sigue sin usar el índice, ni con
1M de filas.** 260ms.

### ¿Por qué? `NOT IN` no es usable como condición de la columna líder

`estado NOT IN ('cerrado', 'resuelto')` se traduce internamente a
`estado <> ALL ('{cerrado,resuelto}')`. Un índice B-tree resuelve
eficientemente igualdad y rangos sobre su columna líder — no una
desigualdad genérica. Con la columna líder (`estado`) inutilizable para
filtrar, el índice quedaría reducido a recorrer `fecha_actualizacion` para
todos los valores de `estado` de todas formas: no hay ganancia real, y
Postgres lo sabe — por eso ni lo intenta.

**Forzando el índice a mano** (`SET enable_seqscan = off`), para confirmar
que el problema es la forma de la consulta y no que el índice esté mal
construido:

```
 Hash Left Join  (cost=50733.90..107075.86 rows=133576 width=97) (actual time=268.654..519.029 rows=79763 loops=1)
   ->  Bitmap Heap Scan on tickets t  (cost=50671.18..106659.70 rows=133576 width=81) (actual time=268.574..493.861 rows=79763 loops=1)
         Recheck Cond: (fecha_actualizacion < (now() - '48:00:00'::interval))
         Filter: (estado <> ALL ('{cerrado,resuelto}'::"EstadoTicket"[]))
         Heap Blocks: exact=25855
         ->  Bitmap Index Scan on tickets_estado_fecha_actualizacion_idx  (cost=0.00..50637.78 rows=133576 width=0) (actual time=264.255..264.256 rows=79763 loops=1)
               Index Cond: (fecha_actualizacion < (now() - '48:00:00'::interval))
 Planning Time: 5.223 ms
 Execution Time: 590.249 ms
```

Nótese el `Index Cond`: solo tiene `fecha_actualizacion`, `estado` bajó a
`Filter` (se aplica después de traer las filas, no como parte de la
búsqueda en el índice) — exactamente porque `NOT IN` no se pudo usar en la
columna líder. Resultado: **590ms, más lento que el sequential scan**. El
índice no solo no ayuda, forzarlo activamente empeora las cosas (más
trabajo: buscar en el índice sin poder aprovechar su primera columna, y
además ir a la tabla fila por fila).

## Plan 3 — 1 millón de filas, consulta reescrita (`estado IN (...)`)

Misma consulta, mismo resultado, reescrita como lista positiva de los 5
estados abiertos en vez de excluir los 2 cerrados:

```
 Hash Left Join  (cost=4781.26..61624.29 rows=133582 width=97) (actual time=27.487..261.888 rows=79763 loops=1)
   Hash Cond: (t.agente_id = u.id)
   ->  Bitmap Heap Scan on tickets t  (cost=4759.34..61248.91 rows=133582 width=81) (actual time=27.362..233.354 rows=79763 loops=1)
         Recheck Cond: ((estado = ANY ('{nuevo,asignado,en_progreso,en_espera_cliente,reabierto}'::"EstadoTicket"[])) AND (fecha_actualizacion < (now() - '48:00:00'::interval)))
         Heap Blocks: exact=25855
         ->  Bitmap Index Scan on tickets_estado_fecha_actualizacion_idx  (cost=0.00..4725.94 rows=133582 width=0) (actual time=23.048..23.048 rows=79763 loops=1)
               Index Cond: ((estado = ANY ('{nuevo,asignado,en_progreso,en_espera_cliente,reabierto}'::"EstadoTicket"[])) AND (fecha_actualizacion < (now() - '48:00:00'::interval)))
   ->  Hash  (cost=15.30..15.30 rows=530 width=48) (actual time=0.024..0.025 rows=6 loops=1)
         ->  Seq Scan on usuarios u  (cost=0.00..15.30 rows=530 width=48) (actual time=0.024..0.025 rows=6 loops=1)
 Planning Time: 6.796 ms
 Execution Time: 266.307 ms
```

**Ahora sí — `Bitmap Index Scan` sobre `tickets_estado_fecha_actualizacion_idx`,
sin forzar nada.** `estado = ANY (...)` (lo que genera `IN`) sí se puede
resolver junto con `fecha_actualizacion` dentro del mismo índice: nótese el
`Index Cond` completo, con las dos columnas — a diferencia del Plan 2
forzado, donde `estado` quedaba fuera como `Filter`. El paso de índice en
sí tomó solo 23ms (`Bitmap Index Scan ... actual time=23.048..23.048`); el
resto del tiempo (266ms totales) es traer las 79763 filas encontradas
desde la tabla (`Heap Blocks: exact=25855`) y el join con `usuarios`.

## Resumen comparativo (1M de filas)

| Versión de la consulta | Plan | Tiempo |
| --- | --- | --- |
| `NOT IN`, sin forzar | Sequential scan paralelo | 260ms |
| `NOT IN`, índice forzado (`enable_seqscan=off`) | Bitmap scan, `estado` fuera del índice | 590ms (peor) |
| `IN` (reescrita) | Bitmap Index Scan, índice completo | 266ms |

**A ~8% de selectividad (la fracción de tickets "olvidados" en los datos de
prueba), `IN` con índice y *sequential scan* quedan en el mismo orden de
magnitud** — no es una goleada. La razón por la que se decidió igual
reescribir la consulta con `IN` no es que 266ms le gane a 260ms (no le
gana, es prácticamente empate): es que **el índice recién empieza a pagarse
cuando la fracción "olvidada" baja** — un backlog sano tiene mucho menos
que 8% de tickets abandonados, y ahí la diferencia entre leer una tajada
chica del índice y recorrer una tabla de millones de filas completa deja
de ser un empate. Con `NOT IN`, esa ganancia futura queda descartada de
entrada porque el índice nunca se puede usar del todo, sin importar cuánto
crezca la tabla o cuánto baje la selectividad.

**El costo de este cambio**: `queries.sql` y `dashboard.service.ts` (que
corre la misma consulta) quedan con la lista explícita de los 5 estados
abiertos en vez de `NOT IN ('cerrado', 'resuelto')`. Si el modelo agrega un
octavo estado algún día, hay que acordarse de sumarlo a esa lista — con
`NOT IN` no haría falta tocar nada. Se acepta ese costo de mantenimiento a
cambio de que la consulta sea la que efectivamente se puede volver rápida
cuando la tabla crezca de verdad.
