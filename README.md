# SISEC CC 2026 / 2027 — Backend API

### Instituto Electoral de la Ciudad de México (IECM)
* **Dirección:** Dirección Ejecutiva de Educación Cívica y Construcción de Ciudadanía (DEECyCC) / Unidad Técnica de Servicios Informáticos (UTSI)
* **Tecnología:** Node.js `>= 20.0.0` + Express `^5.1.0` + SQL Server (Tedious/mssql `^12.5.4`) + Socket.IO `^4.8.3`
* **Arquitectura:** Dual-Pool Database Manager (BD 2027 Operativa `sisec_2027_dev` + BD Histórica `sisecycc2024`)

---

## 📋 Resumen del Módulo

El backend de **SISEC CC** es una API RESTful de alto rendimiento diseñada para la gestión, calendarización, captura de evidencias, aplicación de encuestas y auditoría de actividades de educación cívica para las **33 Direcciones Distritales** y Oficinas Centrales del IECM.

Incorpora comunicación bidireccional en tiempo real a través de **Socket.IO** para la presencia de usuarios en línea, actualización instantánea de radiales de fechas y notificaciones push.

---

## ⚡ Estructura del Proyecto Backend

```
backend/
├── logs/                         # Archivos de bitácora (activity.log, combined.log, error.log)
├── public/                       # Build estático del frontend SPA servido por Express
├── src/
│   ├── config/
│   │   ├── db.js                 # Manejador Dual-Pool de SQL Server (getPool, getNewPool, getHistoricalPool)
│   │   ├── env.js                # Validación y parseo de variables de entorno
│   │   └── logger.js             # Logger centralizado Winston con rotación y consola coloreada
│   ├── controllers/
│   │   ├── authController.js             # Autenticación JWT, verificación Bcrypt y cierre de sesión
│   │   ├── programacion2027Controller.js # Calendarización y catálogo 2027
│   │   ├── captura2027Controller.js      # Matriz 5x6 de población y registro de 4 evidencias
│   │   ├── encuestas2027Controller.js    # Cuestionario Likert de satisfacción y folios consecutivos
│   │   ├── notificaciones2027Controller.js # Chat institucional y avisos en tiempo real
│   │   ├── adminController.js            # Control de fechas, cursos institucionales y parámetros
│   │   ├── usuariosController.js         # CRUD de usuarios y forzado de desconexión
│   │   ├── archivosController.js         # Explorador físico de archivos y descargas ZIP
│   │   ├── formatosController.js         # Descarga segura de formatos .docx
│   │   ├── adminFormatosController.js    # Administración de plantillas oficiales
│   │   ├── permisosController.js         # Matriz de permisos RBAC modular
│   │   └── reportesController.js         # Generador de 14 reportes ejecutivos en Excel (ExcelJS)
│   ├── middlewares/
│   │   ├── auth.js               # Verificación de JWT, inyección de usuario y permisos
│   │   └── errorHandler.js       # Manejo centralizado de excepciones y respuestas JSON
│   ├── models/                   # Capa de abstracción de datos y consultas SQL
│   ├── routes/                   # Definición de routers de Express
│   ├── services/
│   │   ├── fileUpload2027.js     # Procesamiento Multer para evidencias 2027
│   │   └── surveyPdfService.js   # Generación de comprobantes individuales de encuestas
│   ├── socket.js                 # Servidor Socket.IO (presencia, desconexión y difusión en vivo)
│   ├── app.js                    # Middlewares, CORS, Helmet y ruteo
│   └── server.js                 # Arranque del servidor HTTP + WebSocket
├── uploads/                      # Directorio físico de archivos
│   ├── 2027/                     # Almacenamiento estructurado 2027 por distrito
│   └── temp/                     # Cargas temporales para reemplazo
├── .env.development              # Variables de entorno desarrollo local / QA
├── package.json
└── pnpm-lock.yaml
```

---

## 🗄️ Arquitectura de Base de Datos (Dual-Pool)

El backend implementa un patrón **Dual Connection Pool** administrado en `src/config/db.js`:

1. **Pool Activo 2027 (`sisec_2027_dev`):**
   - Tabla `usuarios`: Autenticación con contraseñas encriptadas (Bcrypt), perfil (`id_tipousuario`: 1=Operador, 2=Admin, 3=SuperAdmin) y sede distrital (`id_distrito`: 1-33, 0=Central).
   - Tabla `rel_usuario_permisos`: Control de acceso modular granular (RBAC) para los 6 módulos.
   - Tabla `tbl_acciones_educativas`: Calendarización de compromisos institucionales.
   - Tabla `tbl_captura_evidencias_2027`: Matriz de beneficiarios (5 géneros × 6 rangos de edad) y 4 evidencias oficiales.
   - Tabla `tbl_encuestas_satisfaccion_2027`: Cuestionarios foliados `ENC-AE-DDXX-2027-XXXX-X`.
   - Tabla `config_fechas_acceso`: Ventanas operativas globales y excepciones con `fecha_limite`.
   - Tabla `tbl_mensajes_chat_2027`: Mensajería institucional en tiempo real.

2. **Pool Histórico (`sisecycc2024`):**
   - Base de datos conectada en modo **solo lectura** para consultas históricas, comparativas anuales y generación de reportes agregados acumulados.

---

## 📡 Endpoints Principales de la API

| Módulo | Método | Endpoint | Descripción | Rol Mínimo |
| :--- | :---: | :--- | :--- | :---: |
| **Auth** | `POST` | `/api/auth/login` | Inicio de sesión y entrega de JWT (8h) | Público |
| **Auth** | `POST` | `/api/auth/logout` | Cierre de sesión e invalidación de token | Autenticado |
| **Programación** | `GET` | `/api/programacion-2027/catalogos` | Catálogos institucionales para formulario | Operador |
| **Programación** | `GET` | `/api/programacion-2027/distrito` | Acciones calendarizadas del distrito | Operador |
| **Programación** | `POST` | `/api/programacion-2027` | Registro de nueva acción educativa | Operador |
| **Captura** | `GET` | `/api/captura-2027/distrito` | Bandeja de captura y estado de evidencias | Operador |
| **Captura** | `POST` | `/api/captura-2027/:id/guardar` | Guarda matriz de beneficiarios y 4 archivos | Operador |
| **Captura** | `POST` | `/api/captura-2027/:id/finalizar` | Cierre definitivo y bloqueo de edición | Operador |
| **Encuestas** | `GET` | `/api/captura-2027/:id/encuestas` | Listado de encuestas registradas de la acción | Operador |
| **Encuestas** | `POST` | `/api/captura-2027/:id/encuestas` | Registro individual con folio autoconsecutivo | Operador |
| **Notificaciones** | `GET` | `/api/notificaciones-2027` | Mensajes y alertas del usuario | Operador |
| **Notificaciones** | `POST` | `/api/notificaciones-2027/enviar` | Redacción de mensaje institucional | Operador |
| **Admin Fechas** | `GET` | `/api/admin/restricciones` | Calendario global y excepciones activas | Admin |
| **Admin Fechas** | `POST` | `/api/admin/restricciones` | Guarda periodos y vigencias extemporáneas | Admin |
| **Admin Usuarios**| `GET` | `/api/admin/usuarios` | Lista de usuarios y presencia en línea | Admin |
| **Admin Usuarios**| `POST` | `/api/admin/usuarios` | Alta de usuario con permisos por defecto | SuperAdmin |
| **Admin Usuarios**| `PUT` | `/api/admin/usuarios/:id` | Modificación de rol, distrito o contraseña | Admin |
| **Admin Usuarios**| `PUT` | `/api/admin/usuarios/:id/desconectar` | Cierre de sesión remoto por WebSocket | SuperAdmin |
| **Archivos** | `GET` | `/api/admin/archivos` | Árbol físico de almacenamiento | Admin |
| **Archivos** | `GET` | `/api/admin/archivos/zip` | Descarga masiva comprimida | Admin |

---

## 🧪 Pruebas de Carga y Concurrencia (Apache JMeter)

El backend cuenta con un plan de pruebas automatizado de alta fidelidad:
* **Archivo de prueba:** `sicec_2026_jmeter_test_plan.jmx`
* **Dataset:** `usuarios_distritos.csv` (33 cuentas distritales: `DD01` a `DD33`)
* **Escenario:** 33 usuarios concurrentes ejecutando autenticación JWT, descarga de catálogos, bucle de 10 programaciones en simultáneo y verificación final (**429 peticiones en total**).
* **Resultados certificados:**
  * **Tasa de Error:** `0.00%` (0 fallos).
  * **Latencia Promedio:** `38 ms`.
  * **Percentil 90:** `24 ms`.
  * **Rendimiento:** `32.0 peticiones/segundo`.

---

## 🚀 Puesta en Marcha (Desarrollo y Producción)

### Variables de Entorno (`.env.development`)
```ini
NODE_ENV=development
PORT=3013
APP_URL=https://aplicaciones2qa.iecm.mx/sisec_2026
BACKEND_URL=https://aplicaciones2qa.iecm.mx/sisec_2026

# Base de Datos 2027
DB_SERVER=145.0.40.72
DB_DATABASE=sisec_2027_dev
DB_USER=user1
DB_PASSWORD=u53r1
DB_PORT=1433
DB_ENCRYPT=false
DB_TRUST_SERVER_CERT=true

# JWT
JWT_SECRET=clave_super_secreta_dev
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5173,https://aplicaciones2qa.iecm.mx
```

### Comandos de Ejecución
```bash
# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo con recarga en caliente
pnpm run dev

# Iniciar en producción
pnpm run start
```
