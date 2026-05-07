import mysql.connector
from mysql.connector import Error

def get_connection():
    """Crea y retorna una conexión a la base de datos MySQL."""
    try:
        connection = mysql.connector.connect(
            host='localhost',
            port=3306,
            user='root',       # Usuario por defecto en XAMPP
            password='',       # Contraseña por defecto en XAMPP (vacía)
            database='pandas'
        )
        if connection.is_connected():
            return connection
    except Error as e:
        print(f"[ERROR] No se pudo conectar a MySQL: {e}")
        return None
