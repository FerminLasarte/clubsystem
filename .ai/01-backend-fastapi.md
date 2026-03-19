# Reglas de Desarrollo Backend (FastAPI & Python)

## 1. Tipado Estricto y Validación

- Usa Type Hints estrictos en todas las funciones y endpoints.
- Utiliza siempre modelos Pydantic para la validación exacta de entrada (Requests) y salida (Responses).

## 2. Base de Datos y Transacciones (SQLAlchemy)

- Usa SIEMPRE SQLAlchemy de forma asíncrona (`AsyncSession`).
- TODA operación de modificación a la base de datos (Insert, Update, Delete) DEBE ir dentro de un bloque `try/except`.
- Rollback Obligatorio: En el bloque `except`, es OBLIGATORIO ejecutar `await db.rollback()` antes de lanzar la excepción HTTP para evitar conexiones colgadas en PostgreSQL.

## 3. Observabilidad y Logs

- ESTÁ PROHIBIDO el uso de `print()`.
- Cada vez que crees o modifiques un endpoint, implementa el módulo nativo de logging.
- Usa `logger.info()` para el inicio de peticiones importantes y para registrar éxitos.
- Usa `logger.error()` dentro de los bloques `except` para registrar la traza exacta de los errores.
