# =============================================================
#  algoritmo_paquetes.py
#  Módulo de organización de almacén para LogiSys
#
#  Contiene:
#    · Clase Paquete  — representa un paquete con sus datos
#    · merge_sort()   — ordena paquetes por fecha_salida (D&C)
#    · merge()        — función auxiliar del merge sort
#    · calcular_distancia() — distancia Manhattan desde punto de salida
#    · asignar_paquetes()   — algoritmo voraz de asignación de posiciones
#    · organizar()    — función principal que integra todo el flujo
#
#  USO DESDE app.py:
#    from algoritmo_paquetes import organizar
#    resultado = organizar(filas_db, filas_almacen=4, columnas_almacen=5)
# =============================================================


# ─────────────────────────────────────────────
#  CLASE Paquete
#  Adapta los datos que vienen de la base de datos
#  (dict con paquete_id, fecha_salida, tipo, etc.)
#  a la estructura que necesita el algoritmo.
# ─────────────────────────────────────────────
class Paquete:
    def __init__(self, paquete_id, fecha_salida, tipo):
        self.id           = paquete_id    # INT  — clave primaria en DB
        self.fecha_salida = fecha_salida  # date — usado para ordenar
        self.tipo         = tipo          # str  — sección/categoría
        self.posicion     = None          # (fila, col) asignada por el voraz

    def __repr__(self):
        return (
            f"Paquete(id={self.id}, "
            f"salida={self.fecha_salida}, "
            f"tipo={self.tipo}, "
            f"pos={self.posicion})"
        )


# ─────────────────────────────────────────────
#  MERGE SORT  — Divide y vencerás
#  Ordena la lista de Paquetes por fecha_salida
#  de menor a mayor (el que sale antes, primero).
#  No usa sort() del lenguaje.
# ─────────────────────────────────────────────
def merge_sort(paquetes):
    """
    Divide la lista a la mitad recursivamente
    hasta tener sublistas de 1 elemento,
    luego las fusiona en orden.
    """
    if len(paquetes) <= 1:
        return paquetes

    mid       = len(paquetes) // 2
    izquierda = merge_sort(paquetes[:mid])
    derecha   = merge_sort(paquetes[mid:])

    return merge(izquierda, derecha)


def merge(izquierda, derecha):
    """
    Fusiona dos sublistas ya ordenadas en una sola.
    Compara fecha_salida elemento a elemento.
    """
    resultado = []
    i = j = 0

    while i < len(izquierda) and j < len(derecha):
        if izquierda[i].fecha_salida <= derecha[j].fecha_salida:
            resultado.append(izquierda[i])
            i += 1
        else:
            resultado.append(derecha[j])
            j += 1

    # Agrega los elementos restantes de la sublista que no terminó
    resultado.extend(izquierda[i:])
    resultado.extend(derecha[j:])

    return resultado


# ─────────────────────────────────────────────
#  DISTANCIA MANHATTAN
#  Usada por el algoritmo voraz para medir
#  qué tan lejos está una celda del punto
#  de salida del almacén (esquina 0,0).
# ─────────────────────────────────────────────
def calcular_distancia(celda, salida):
    """
    Distancia Manhattan entre dos puntos (fila, col).
    Más eficiente que Euclidiana para grillas.
    """
    return abs(celda[0] - salida[0]) + abs(celda[1] - salida[1])


# ─────────────────────────────────────────────
#  ALGORITMO VORAZ — Asignación de posiciones
#  Para cada paquete (ya ordenados por fecha),
#  busca la celda libre más cercana al punto
#  de salida y se la asigna.
#  El que sale primero queda más cerca → sale más rápido.
# ─────────────────────────────────────────────
def asignar_paquetes(almacen, paquetes):
    """
    almacen  : lista 2D de listas — None = celda libre
    paquetes : lista de Paquete, ya ordenada por merge_sort

    Modifica paquete.posicion y la celda del almacén in-place.
    Retorna la lista de paquetes con posiciones asignadas.
    """
    salida   = (0, 0)  # Punto de salida: esquina superior-izquierda
    filas    = len(almacen)
    columnas = len(almacen[0])

    for paquete in paquetes:
        mejor_pos       = None
        mejor_distancia = float('inf')

        # Recorre toda la grilla buscando la celda libre más cercana
        for i in range(filas):
            for j in range(columnas):
                if almacen[i][j] is None:                       # celda libre
                    distancia = calcular_distancia((i, j), salida)
                    if distancia < mejor_distancia:
                        mejor_distancia = distancia
                        mejor_pos       = (i, j)

        # Si encontró una celda, asigna el paquete
        if mejor_pos is not None:
            fila, col          = mejor_pos
            almacen[fila][col] = paquete
            paquete.posicion   = mejor_pos

    return paquetes


# ─────────────────────────────────────────────
#  FUNCIÓN PRINCIPAL — organizar()
#  Punto de entrada que usa app.py.
#  Recibe las filas crudas de la DB y devuelve
#  una lista de dicts listos para JSON / DB.
# ─────────────────────────────────────────────
def organizar(filas_db, filas_almacen=4, columnas_almacen=5):
    """
    Parámetros:
      filas_db         : list[dict] con claves paquete_id, fecha_salida, tipo
      filas_almacen    : alto de la grilla del almacén  (default 4)
      columnas_almacen : ancho de la grilla del almacén (default 5)

    Retorna:
      list[dict] con claves:
        paquete_id, tipo, fecha_salida, posicion_fila, posicion_col, orden
    """
    # 1. Convertir filas de DB → objetos Paquete
    paquetes = [
        Paquete(
            paquete_id  = fila['paquete_id'],
            fecha_salida = fila['fecha_salida'],
            tipo        = fila['tipo']
        )
        for fila in filas_db
    ]

    # 2. Ordenar por fecha_salida con Merge Sort (sin sort())
    paquetes_ordenados = merge_sort(paquetes)

    # 3. Crear grilla vacía del almacén
    almacen = [[None] * columnas_almacen for _ in range(filas_almacen)]

    # 4. Asignar posiciones con algoritmo voraz
    asignar_paquetes(almacen, paquetes_ordenados)

    # 5. Construir resultado serializable para JSON y para guardar en DB
    resultado = []
    for orden, paquete in enumerate(paquetes_ordenados, start=1):
        fila_pos = paquete.posicion[0] if paquete.posicion else None
        col_pos  = paquete.posicion[1] if paquete.posicion else None
        resultado.append({
            'paquete_id'    : paquete.id,
            'tipo'          : paquete.tipo,
            'fecha_salida'  : str(paquete.fecha_salida),
            'orden'         : orden,           # 1 = sale primero
            'posicion_fila' : fila_pos,
            'posicion_col'  : col_pos,
            # Etiqueta legible, ej. "F1-C3"
            'posicion_label': f"F{fila_pos + 1}-C{col_pos + 1}" if paquete.posicion else "Sin espacio",
        })

    return resultado
