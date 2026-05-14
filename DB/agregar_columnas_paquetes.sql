-- ============================================================
--  LogiSys — Agregar columnas de organización a la tabla paquetes
--  Ejecutar UNA SOLA VEZ en phpMyAdmin sobre la base `pandas`
-- ============================================================

ALTER TABLE paquetes
    ADD COLUMN IF NOT EXISTS posicion_fila  TINYINT  NULL COMMENT 'Fila asignada en el almacén (0-based)',
    ADD COLUMN IF NOT EXISTS posicion_col   TINYINT  NULL COMMENT 'Columna asignada en el almacén (0-based)',
    ADD COLUMN IF NOT EXISTS orden_salida   SMALLINT NULL COMMENT 'Orden de salida calculado por Merge Sort';
