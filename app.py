import os
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from config import get_connection
from datetime import datetime
from functools import wraps
import hashlib
from algoritmo_paquetes import organizar
import unicodedata
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, template_folder=BASE_DIR)
app.secret_key = 'logistica_almacen_secret_2024'


def dict_cursor(connection):
    import mysql.connector.cursor as _mc
    return connection.cursor(cursor_class=_mc.MySQLCursorDict)


def generar_correo(nombre: str, apellido: str, connection) -> str:
    def limpiar(texto: str) -> str:
        texto = texto.strip().lower()
        texto = unicodedata.normalize('NFD', texto)
        texto = ''.join(c for c in texto if unicodedata.category(c) != 'Mn')
        texto = re.sub(r'[^a-z0-9]', '', texto)
        return texto

    base   = limpiar(nombre) + limpiar(apellido)
    correo = base + '@almacenes.com'

    cur = dict_cursor(connection)
    cur.execute("SELECT COUNT(*) AS total FROM empleados WHERE correo = %s", (correo,))
    row = cur.fetchone()
    cur.close()

    if row is not None and row['total'] == 0:
        return correo

    sufijo = 2
    while True:
        correo_alt = f"{base}{sufijo}@almacenes.com"
        cur = dict_cursor(connection)
        cur.execute("SELECT COUNT(*) AS total FROM empleados WHERE correo = %s", (correo_alt,))
        row = cur.fetchone()
        cur.close()
        if row is not None and row['total'] == 0:
            return correo_alt
        sufijo += 1


def login_requerido(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'empleado_id' not in session:
            flash('Debes iniciar sesion para acceder.', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

@app.route('/', methods=['GET', 'POST'])
@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'empleado_id' in session:
        return redirect(url_for('index'))

    if request.method == 'POST':
        correo   = (request.form.get('correo') or '').strip().lower()
        password = (request.form.get('password') or '').strip()

        if not correo or not password:
            flash('Por favor, ingresa tu correo y contrasena.', 'danger')
            return render_template('template/index.html')

        pass_hash  = hashlib.sha256(password.encode()).hexdigest()
        connection = get_connection()
        if connection is None:
            flash('Error de conexion con la base de datos.', 'danger')
            return render_template('template/index.html')

        try:
            cursor = dict_cursor(connection)
            cursor.execute("""
                SELECT empleado_id, nombre1, apellido1, rol
                FROM   empleados
                WHERE  correo = %s AND pass = %s AND eliminado = 0
            """, (correo, pass_hash))
            empleado = cursor.fetchone()

            if empleado:
                session['empleado_id'] = empleado['empleado_id']
                session['nombre']      = f"{empleado['nombre1']} {empleado['apellido1']}"
                session['rol']         = empleado['rol']
                flash(f"Bienvenido, {empleado['nombre1']}.", 'success')
                return redirect(url_for('index'))
            else:
                flash('Correo o contrasena incorrectos.', 'danger')
                return render_template('template/index.html')

        except Exception as e:
            flash(f'Error al iniciar sesion: {str(e)}', 'danger')
            return render_template('template/index.html')
        finally:
            try:
                cursor.fetchall()  # vaciar resultados pendientes
            except Exception:
                pass
            cursor.close()
            connection.close()

    return render_template('template/index.html')


@app.route('/logout')
def logout():
    session.clear()
    flash('Sesion cerrada correctamente.', 'info')
    return redirect(url_for('login'))


@app.route('/dashboard')
@login_requerido
def index():
    return render_template('template/dashboard.html')


@app.route('/subir_empleado', methods=['GET', 'POST'])
@login_requerido
def subir_empleado():
    if request.method == 'POST':
        nombre1    = (request.form.get('nombre1')   or '').strip()
        nombre2    = (request.form.get('nombre2')   or '').strip() or None
        apellido1  = (request.form.get('apellido1') or '').strip()
        apellido2  = (request.form.get('apellido2') or '').strip() or None
        password   = (request.form.get('pass')      or '').strip()
        rol_str    = (request.form.get('rol')       or '').strip()
        estado_str = (request.form.get('estado')    or '').strip()
        nss_str    = (request.form.get('nss')       or '').strip()
        sueldo_str = (request.form.get('sueldo')    or '').strip()
        seccion    = (request.form.get('seccion')   or '').strip()

        if not all([nombre1, apellido1, password, rol_str, estado_str, nss_str, sueldo_str, seccion]):
            flash('Por favor, completa todos los campos obligatorios.', 'danger')
            return render_template('template/subir_empleado.html')

        try:
            rol    = int(rol_str)
            estado = int(estado_str)
            nss    = int(nss_str)
            sueldo = int(sueldo_str)
        except ValueError:
            flash('Rol, estado, NSS y sueldo deben ser valores numericos.', 'danger')
            return render_template('template/subir_empleado.html')

        fecha_ingreso_ET = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        pass_hash        = hashlib.sha256(password.encode()).hexdigest()

        connection = get_connection()
        if connection is None:
            flash('Error de conexion con la base de datos.', 'danger')
            return render_template('template/subir_empleado.html')

        try:
            correo = generar_correo(nombre1, apellido1, connection)
            cursor = connection.cursor()
            cursor.execute("""
                INSERT INTO empleados
                    (nombre1, nombre2, apellido1, apellido2, pass, rol, estado,
                     paquete_asignado_id, nss, fecha_ingreso_ET, sueldo, seccion, eliminado, correo)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (nombre1, nombre2, apellido1, apellido2, pass_hash,
                  rol, estado, 0, nss, fecha_ingreso_ET, sueldo, seccion, 0, correo))
            connection.commit()
            flash(f'Empleado "{nombre1} {apellido1}" registrado. Correo asignado: {correo}', 'success')
            return redirect(url_for('ver_tabla'))

        except Exception as e:
            connection.rollback()
            flash(f'Error al registrar empleado: {str(e)}', 'danger')
            return render_template('template/subir_empleado.html')
        finally:
            cursor.close()
            connection.close()

    return render_template('template/subir_empleado.html')


@app.route('/ver_tabla')
@login_requerido
def ver_tabla():
    connection = get_connection()
    if connection is None:
        flash('Error de conexion con la base de datos.', 'danger')
        return render_template('template/ver_tabla.html', empleados=[])

    try:
        cursor = dict_cursor(connection)
        cursor.execute("""
            SELECT empleado_id, nombre1, nombre2, apellido1, apellido2,
                   rol, estado, nss, fecha_ingreso_ET, sueldo, seccion,
                   paquete_asignado_id, correo
            FROM   empleados
            WHERE  eliminado = 0
            ORDER  BY empleado_id DESC
        """)
        empleados = cursor.fetchall()
        return render_template('template/ver_tabla.html', empleados=empleados)
    except Exception as e:
        flash(f'Error al obtener empleados: {str(e)}', 'danger')
        return render_template('template/ver_tabla.html', empleados=[])
    finally:
        cursor.close()
        connection.close()

@app.route('/eliminar_empleado/<int:empleado_id>', methods=['POST'])
@login_requerido
def eliminar_empleado(empleado_id):
    connection = get_connection()
    if connection is None:
        flash('Error de conexion con la base de datos.', 'danger')
        return redirect(url_for('ver_tabla'))

    try:
        cursor = connection.cursor()
        cursor.execute(
            "UPDATE empleados SET eliminado = 1 WHERE empleado_id = %s",
            (empleado_id,)
        )
        connection.commit()
        flash('Empleado eliminado correctamente.', 'success')
    except Exception as e:
        connection.rollback()
        flash(f'Error al eliminar empleado: {str(e)}', 'danger')
    finally:
        cursor.close()
        connection.close()

    return redirect(url_for('ver_tabla'))


@app.route('/crear_paquete', methods=['GET', 'POST'])
@login_requerido
def crear_paquete():
    siguiente_id = 1
    connection   = get_connection()

    if connection is not None:
        try:
            cur = dict_cursor(connection)
            cur.execute("SELECT COALESCE(MAX(paquete_id), 0) + 1 AS siguiente FROM paquetes")
            row = cur.fetchone()
            if row is not None:
                siguiente_id = row['siguiente']
            cur.close()
        except Exception:
            pass

    if request.method == 'POST':
        tipo         = (request.form.get('tipo')         or '').strip()
        estado       = (request.form.get('estado')       or '').strip()
        fecha_salida = (request.form.get('fecha_salida') or '').strip()
        hora_salida  = (request.form.get('hora_salida')  or '').strip()
        descripcion  = (request.form.get('descripcion')  or '').strip() or None
        creado_por   = session.get('empleado_id')

        if not all([tipo, estado, fecha_salida, hora_salida]):
            flash('Por favor, completa todos los campos obligatorios.', 'danger')
            if connection:
                connection.close()
            return render_template('template/crear_paquete.html', siguiente_id=siguiente_id)

        if connection is None:
            flash('Error de conexion con la base de datos.', 'danger')
            return render_template('template/crear_paquete.html', siguiente_id=siguiente_id)

        try:
            cursor = connection.cursor()
            cursor.execute("""
                INSERT INTO paquetes
                    (tipo, estado, fecha_salida, hora_salida, descripcion, creado_por, eliminado)
                VALUES (%s, %s, %s, %s, %s, %s, 0)
            """, (tipo, estado, fecha_salida, hora_salida, descripcion, creado_por))
            connection.commit()
            nuevo_id = cursor.lastrowid
            flash(f'Paquete #{str(nuevo_id).zfill(4)} creado exitosamente.', 'success')
            return redirect(url_for('ver_paquetes'))
        except Exception as e:
            connection.rollback()
            flash(f'Error al crear paquete: {str(e)}', 'danger')
            return render_template('template/crear_paquete.html', siguiente_id=siguiente_id)
        finally:
            cursor.close()
            connection.close()

    if connection:
        connection.close()
    return render_template('template/crear_paquete.html', siguiente_id=siguiente_id)


@app.route('/ver_paquetes')
@login_requerido
def ver_paquetes():
    connection = get_connection()
    if connection is None:
        flash('Error de conexion con la base de datos.', 'danger')
        return render_template('template/ver_paquetes.html', paquetes=[])

    try:
        cursor = dict_cursor(connection)
        cursor.execute("""
            SELECT p.paquete_id, p.tipo, p.estado, p.fecha_salida,
                   p.hora_salida, p.descripcion,
                   p.posicion_fila, p.posicion_col, p.orden_salida,
                   CONCAT(e.nombre1, ' ', e.apellido1) AS creado_por
            FROM   paquetes p
            LEFT JOIN empleados e ON e.empleado_id = p.creado_por
            WHERE  p.eliminado = 0
            ORDER  BY p.paquete_id DESC
        """)
        paquetes_raw = cursor.fetchall()

        import datetime
        paquetes = []
        for p in paquetes_raw:
            p = dict(p)
            if isinstance(p.get('hora_salida'), datetime.timedelta):
                total_segundos = int(p['hora_salida'].total_seconds())
                horas   = total_segundos // 3600
                minutos = (total_segundos % 3600) // 60
                p['hora_salida'] = datetime.time(horas % 24, minutos)
            paquetes.append(p)

        return render_template('template/ver_paquetes.html', paquetes=paquetes)
    except Exception as e:
        flash(f'Error al obtener paquetes: {str(e)}', 'danger')
        return render_template('ver_paquetes.html', paquetes=[])
    finally:
        cursor.close()
        connection.close()


@app.route('/eliminar_paquete/<int:paquete_id>', methods=['POST'])
@login_requerido
def eliminar_paquete(paquete_id):
    connection = get_connection()
    if connection is None:
        flash('Error de conexion con la base de datos.', 'danger')
        return redirect(url_for('ver_paquetes'))

    try:
        cursor = connection.cursor()
        cursor.execute(
            "UPDATE paquetes SET eliminado = 1 WHERE paquete_id = %s",
            (paquete_id,)
        )
        connection.commit()
        flash(f'Paquete #{str(paquete_id).zfill(4)} eliminado correctamente.', 'success')
    except Exception as e:
        connection.rollback()
        flash(f'Error al eliminar paquete: {str(e)}', 'danger')
    finally:
        cursor.close()
        connection.close()

    return redirect(url_for('ver_paquetes'))


@app.route('/organizar_almacen')
@login_requerido
def organizar_almacen():
    filas_almacen    = int(request.args.get('filas',    4))
    columnas_almacen = int(request.args.get('columnas', 5))

    connection = get_connection()
    if connection is None:
        return jsonify({'error': 'Sin conexion a la base de datos'}), 500

    try:
        cursor = dict_cursor(connection)
        cursor.execute("""
            SELECT paquete_id, fecha_salida, tipo
            FROM   paquetes
            WHERE  eliminado = 0
            ORDER  BY paquete_id ASC
        """)
        filas_db = cursor.fetchall()

        if not filas_db:
            return jsonify({'resultado': [], 'mensaje': 'No hay paquetes activos'})

        resultado = organizar(filas_db, filas_almacen, columnas_almacen)

        for item in resultado:
            cursor.execute("""
                UPDATE paquetes
                SET    posicion_fila = %s,
                       posicion_col  = %s,
                       orden_salida  = %s
                WHERE  paquete_id   = %s
            """, (
                item['posicion_fila'],
                item['posicion_col'],
                item['orden'],
                item['paquete_id']
            ))

        connection.commit()
        return jsonify({
            'filas'    : filas_almacen,
            'columnas' : columnas_almacen,
            'resultado': resultado
        })

    except Exception as e:
        connection.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        connection.close()



@app.route('/almacen')
@login_requerido
def almacen():
    return render_template('template/almacen.html')


@app.route('/api/almacen')
@login_requerido
def api_almacen():
    import datetime as dt
    FILAS    = 4
    COLUMNAS = 5

    connection = get_connection()
    if connection is None:
        return jsonify({'error': 'Sin conexion'}), 500

    try:
        cursor = dict_cursor(connection)
        cursor.execute("""
            SELECT paquete_id, tipo, estado, fecha_salida,
                   posicion_fila, posicion_col, orden_salida, descripcion
            FROM   paquetes
            WHERE  eliminado = 0
              AND  posicion_fila IS NOT NULL
              AND  posicion_col  IS NOT NULL
        """)
        paquetes = cursor.fetchall()

        grilla = [[None] * COLUMNAS for _ in range(FILAS)]

        for p in paquetes:
            f = p['posicion_fila']
            c = p['posicion_col']
            if 0 <= f < FILAS and 0 <= c < COLUMNAS:
                grilla[f][c] = {
                    'id'          : p['paquete_id'],
                    'tipo'        : p['tipo'],
                    'estado'      : p['estado'],
                    'fecha_salida': str(p['fecha_salida']),
                    'orden'       : p['orden_salida'],
                    'descripcion' : p['descripcion'] or '',
                }

        cursor.execute("""
            SELECT paquete_id, tipo, estado, fecha_salida, descripcion
            FROM   paquetes
            WHERE  eliminado = 0
              AND  (posicion_fila IS NULL OR posicion_col IS NULL)
            ORDER  BY paquete_id ASC
        """)
        sin_posicion = []
        for p in cursor.fetchall():
            sin_posicion.append({
                'id'          : p['paquete_id'],
                'tipo'        : p['tipo'],
                'estado'      : p['estado'],
                'fecha_salida': str(p['fecha_salida']),
                'descripcion' : p['descripcion'] or '',
            })

        return jsonify({
            'filas'        : FILAS,
            'columnas'     : COLUMNAS,
            'grilla'       : grilla,
            'sin_posicion' : sin_posicion,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        connection.close()

if __name__ == '__main__':
    app.run(debug=True)
