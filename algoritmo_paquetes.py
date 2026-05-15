from datetime import datetime, time as _time, timedelta


class Paquete:
    def __init__(self, paquete_id, fecha_salida, hora_salida, tipo):
        self.id = paquete_id
        self.fecha_salida = _parse_fecha_hora(fecha_salida, hora_salida)
        self.tipo = tipo
        self.posicion = None

    def __repr__(self):
        return (
            f"Paquete(id={self.id}, "
            f"salida={self.fecha_salida}, "
            f"tipo={self.tipo}, "
            f"pos={self.posicion})"
        )


def merge_sort(paquetes):
    if len(paquetes) <= 1:
        return paquetes

    mid       = len(paquetes) // 2
    izquierda = merge_sort(paquetes[:mid])
    derecha   = merge_sort(paquetes[mid:])

    return merge(izquierda, derecha)


def merge(izquierda, derecha):
    resultado = []
    i = j = 0

    while i < len(izquierda) and j < len(derecha):
        if izquierda[i].fecha_salida <= derecha[j].fecha_salida:
            resultado.append(izquierda[i])
            i += 1
        else:
            resultado.append(derecha[j])
            j += 1

    resultado.extend(izquierda[i:])
    resultado.extend(derecha[j:])

    return resultado

def calcular_distancia(celda, salida):
    return abs(celda[0] - salida[0]) + abs(celda[1] - salida[1])

def asignar_paquetes(almacen, paquetes, puertas=None):
    if not puertas:
        puertas = [(0, 0)]

    filas = len(almacen)
    columnas = len(almacen[0])

    for paquete in paquetes:
        mejor_pos = None
        mejor_distancia = float('inf')

        for i in range(filas):
            for j in range(columnas):
                if almacen[i][j] is None:
                    dist_puerta = min(abs(i - p[0]) + abs(j - p[1]) for p in puertas)
                    if dist_puerta < mejor_distancia:
                        mejor_distancia = dist_puerta
                        mejor_pos = (i, j)

        if mejor_pos is not None:
            fila, col = mejor_pos
            almacen[fila][col] = paquete
            paquete.posicion = mejor_pos

    return paquetes


def _parse_fecha_hora(fecha, hora):
    if fecha is None:
        fecha_dt = datetime.now()
    else:
        if isinstance(fecha, str):
            try:
                fecha_dt = datetime.fromisoformat(fecha)
            except Exception:
                # Fecha sin hora
                fecha_dt = datetime.fromisoformat(fecha + 'T00:00:00')
        elif hasattr(fecha, 'year'):
            # date or datetime
            if hasattr(fecha, 'hour'):
                fecha_dt = datetime(fecha.year, fecha.month, fecha.day, fecha.hour, getattr(fecha, 'minute', 0))
            else:
                fecha_dt = datetime(fecha.year, fecha.month, fecha.day)
        else:
            fecha_dt = datetime.now()

    if hora is None:
        return fecha_dt

    if isinstance(hora, str):
        try:
            t = _time.fromisoformat(hora)
            return datetime(fecha_dt.year, fecha_dt.month, fecha_dt.day, t.hour, t.minute, t.second)
        except Exception:
            return fecha_dt

    if isinstance(hora, timedelta):
        total_seconds = int(hora.total_seconds())
        h = total_seconds // 3600
        m = (total_seconds % 3600) // 60
        return datetime(fecha_dt.year, fecha_dt.month, fecha_dt.day, h % 24, m)

    if hasattr(hora, 'hour'):
        return datetime(fecha_dt.year, fecha_dt.month, fecha_dt.day, hora.hour, getattr(hora, 'minute', 0))

    return fecha_dt


def organizar(filas_db, filas_almacen=4, columnas_almacen=5, puertas=None, puerta_activa=None):
    paquetes = []
    for fila in filas_db:
        paquetes.append(Paquete(
            paquete_id = fila.get('paquete_id'),
            fecha_salida = fila.get('fecha_salida'),
            hora_salida = fila.get('hora_salida') if 'hora_salida' in fila else None,
            tipo = fila.get('tipo')
        ))

    paquetes_ordenados = merge_sort(paquetes)

    almacen = [[None] * columnas_almacen for _ in range(filas_almacen)]

    puertas_t = []
    if puerta_activa:
        try:
            if isinstance(puerta_activa, dict):
                puertas_t = [(int(puerta_activa.get('f')), int(puerta_activa.get('c')))]
            else:
                puertas_t = [(int(puerta_activa[0]), int(puerta_activa[1]))]
        except Exception:
            puertas_t = []
    else:
        if puertas:
            for p in puertas:
                try:
                    if isinstance(p, dict):
                        puertas_t.append((int(p['f']), int(p['c'])))
                    else:
                        puertas_t.append((int(p[0]), int(p[1])))
                except Exception:
                    pass

    asignar_paquetes(almacen, paquetes_ordenados, puertas=puertas_t)

    resultado = []
    for orden, paquete in enumerate(paquetes_ordenados, start=1):
        fila_pos = paquete.posicion[0] if paquete.posicion else None
        col_pos = paquete.posicion[1] if paquete.posicion else None
        resultado.append({
            'paquete_id': paquete.id,
            'tipo': paquete.tipo,
            'fecha_salida': paquete.fecha_salida.isoformat() if hasattr(paquete.fecha_salida, 'isoformat') else str(paquete.fecha_salida),
            'orden': orden,
            'posicion_fila': fila_pos,
            'posicion_col': col_pos,
            'posicion_label': (f"F{fila_pos + 1}-C{col_pos + 1}" if paquete.posicion else "Sin espacio"),
        })

    return resultado