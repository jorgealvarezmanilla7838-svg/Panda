-- ============================================================
--  LogiSys — Tabla de paquetes
--  Ejecutar en phpMyAdmin o MySQL sobre la base de datos `pandas`
-- ============================================================

CREATE TABLE IF NOT EXISTS paquetes (
    paquete_id   INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tipo         VARCHAR(60)  NOT NULL,
    estado       VARCHAR(40)  NOT NULL DEFAULT 'En almacén',
    fecha_salida DATE         NOT NULL,
    hora_salida  TIME         NOT NULL,
    descripcion  VARCHAR(255)     NULL,
    creado_por   INT              NULL,   -- empleado_id que lo registró
    eliminado    TINYINT(1)   NOT NULL DEFAULT 0,

    CONSTRAINT fk_paquete_empleado
        FOREIGN KEY (creado_por)
        REFERENCES empleados(empleado_id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
