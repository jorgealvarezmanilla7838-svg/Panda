class Paquete:
    def __init__(self, paquete_id, fecha_salida, tipo):
        self.id           = paquete_id    
        self.fecha_salida = fecha_salida  
        self.tipo         = tipo          
        self.posicion     = None          

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

def asignar_paquetes(almacen, paquetes):
    salida   = (0, 0)      
    filas    = len(almacen)
    columnas = len(almacen[0])

    for paquete in paquetes:
        mejor_pos       = None
        mejor_distancia = float('inf')

        for i in range(filas):
            for j in range(columnas):
                if almacen[i][j] is None:                       # celda libre
                    distancia = calcular_distancia((i, j), salida)
                    if distancia < mejor_distancia:
                        mejor_distancia = distancia
                        mejor_pos       = (i, j)

        if mejor_pos is not None:
            fila, col          = mejor_pos
            almacen[fila][col] = paquete
            paquete.posicion   = mejor_pos

    return paquetes


def organizar(filas_db, filas_almacen=4, columnas_almacen=5):
    paquetes = [
        Paquete(
            paquete_id  = fila['paquete_id'],
            fecha_salida = fila['fecha_salida'],
            tipo        = fila['tipo']
        )
        for fila in filas_db
    ]

    paquetes_ordenados = merge_sort(paquetes)

    almacen = [[None] * columnas_almacen for _ in range(filas_almacen)]

    asignar_paquetes(almacen, paquetes_ordenados)

    resultado = []
    for orden, paquete in enumerate(paquetes_ordenados, start=1):
        fila_pos = paquete.posicion[0] if paquete.posicion else None
        col_pos  = paquete.posicion[1] if paquete.posicion else None
        resultado.append({
            'paquete_id'    : paquete.id,
            'tipo'          : paquete.tipo,
            'fecha_salida'  : str(paquete.fecha_salida),
            'orden'         : orden,           
            'posicion_fila' : fila_pos,
            'posicion_col'  : col_pos,
            'posicion_label': f"F{fila_pos + 1}-C{col_pos + 1}" if paquete.posicion else "Sin espacio",
        })

    return resultado
