import uuid
from typing import Optional, List, Dict, Any
import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from pgvector.psycopg import register_vector
from app.config import DATABASE_URL

_pool: Optional[ConnectionPool] = None


def _configurar_conexion(conn):
    """Configura cada conexión nueva del pool (registro del tipo 'vector')."""
    register_vector(conn)


def inicializar_pool(min_size: int = 1, max_size: int = 10):
    """Abre el pool global de conexiones a PostgreSQL (idempotente)."""
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            DATABASE_URL,
            min_size=min_size,
            max_size=max_size,
            open=False,
            kwargs={"connect_timeout": 10},
            timeout=10,
            configure=_configurar_conexion,
        )
        _pool.open()
        print(f"[DB] Pool abierto (min={min_size}, max={max_size}).")


def cerrar_pool():
    """Cierra el pool global al apagar la aplicación."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
        print("[DB] Pool cerrado.")


def get_connection():
    """Retorna una conexión del pool lista para usar (vector ya registrado)."""
    inicializar_pool()
    return _pool.connection()


def check_db_health() -> bool:
    """Verifica si la base de datos responde a un SELECT 1."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
                row = cur.fetchone()
                return bool(row and row[0] == 1)
    except Exception as e:
        print(f"Error al verificar la base de datos: {e}")
        return False


def crear_documento(doc_id: uuid.UUID, nombre: str) -> Dict[str, Any]:
    """Inserta un nuevo documento en la tabla documentos en estado 'procesando'."""
    sql = """
        INSERT INTO documentos (doc_id, nombre, estado, imagenes_total, imagenes_procesadas)
        VALUES (%s, %s, 'procesando', 0, 0)
        RETURNING doc_id, nombre, paginas, estado, error, imagenes_total, imagenes_procesadas, creado_en;
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, (doc_id, nombre))
            doc = cur.fetchone()
            conn.commit()
            return doc


def actualizar_documento(
    doc_id: uuid.UUID,
    paginas: Optional[int] = None,
    estado: Optional[str] = None,
    error: Optional[str] = None,
    imagenes_total: Optional[int] = None,
    imagenes_procesadas: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """Actualiza los campos de un documento de forma dinámica según los argumentos presentes."""
    campos = []
    valores = []

    if paginas is not None:
        campos.append("paginas = %s")
        valores.append(paginas)
    if estado is not None:
        campos.append("estado = %s")
        valores.append(estado)
    if error is not None:
        campos.append("error = %s")
        valores.append(error)
    if imagenes_total is not None:
        campos.append("imagenes_total = %s")
        valores.append(imagenes_total)
    if imagenes_procesadas is not None:
        campos.append("imagenes_procesadas = %s")
        valores.append(imagenes_procesadas)

    if not campos:
        return obtener_documento(doc_id)

    valores.append(doc_id)
    sql = f"""
        UPDATE documentos
        SET {', '.join(campos)}
        WHERE doc_id = %s
        RETURNING doc_id, nombre, paginas, estado, error, imagenes_total, imagenes_procesadas, creado_en;
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, tuple(valores))
            doc = cur.fetchone()
            conn.commit()
            return doc


def obtener_documento(doc_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    """Obtiene un documento por su doc_id."""
    sql = """
        SELECT doc_id, nombre, paginas, estado, error, imagenes_total, imagenes_procesadas, creado_en
        FROM documentos
        WHERE doc_id = %s;
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, (doc_id,))
            return cur.fetchone()


def listar_documentos() -> List[Dict[str, Any]]:
    """Retorna todos los documentos ordenados por fecha de creación descendente."""
    sql = """
        SELECT doc_id, nombre, paginas, estado, error, imagenes_total, imagenes_procesadas, creado_en
        FROM documentos
        ORDER BY creado_en DESC;
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql)
            return cur.fetchall()


def eliminar_documento(doc_id: uuid.UUID) -> bool:
    """
    Elimina un documento por su doc_id.
    Los chunks asociados se eliminan en cascada (ON DELETE CASCADE).
    Retorna True si fue eliminado, False si no existía.
    """
    sql = "DELETE FROM documentos WHERE doc_id = %s RETURNING doc_id;"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (doc_id,))
            eliminado = cur.fetchone()
            conn.commit()
            return bool(eliminado)

