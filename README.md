# 🐾 VetRegistro API - Backend de Gestión Veterinaria y Mascotas

[![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?style=flat&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=flat&logo=postgresql&logoColor=white)](https://supabase.com/)
[![TypeORM](https://img.shields.io/badge/TypeORM-0.3.x-FE0803?style=flat&logo=typeorm&logoColor=white)](https://typeorm.io/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Render](https://img.shields.io/badge/Render-Deployed-46E3B7?style=flat&logo=render&logoColor=black)](https://render.com/)

API RESTful empresarial de alto rendimiento para el registro de mascotas, expedientes médicos veterinarios, control de usuarios con roles (RBAC) y auditoría inmutable de acciones. Diseñada bajo una arquitectura modular y segura, lista para entornos de producción.

---

## 🛠️ Tecnologías Utilizadas

| Categoría | Tecnología | Descripción |
| :--- | :--- | :--- |
| **Framework Base** | **NestJS 11** | Arquitectura modular escalable basada en TypeScript y Node.js. |
| **Lenguaje** | **TypeScript 5** | Tipado estático estricto para confiabilidad en tiempo de compilación. |
| **Base de Datos** | **PostgreSQL (Supabase)** | Base de datos relacional robusta en la nube con cifrado SSL/TLS. |
| **ORM** | **TypeORM** | Mapeo objeto-relacional con migraciones y sincronización automática. |
| **Seguridad & Auth** | **Passport + JWT + Bcrypt** | Tokens de acceso y refresh tokens con hashing unidireccional de 12 rondas. |
| **Protección Perimetral** | **Helmet + Throttler** | Headers HTTP de seguridad estricta y limitación de peticiones (Rate Limiting). |
| **Validación de Datos** | **Class-Validator & Transformer** | Defensa activa contra inyección de parámetros y mass-assignment. |
| **Documentación** | **Swagger OpenAPI 3** | Especificación interactiva de todos los endpoints. |
| **Contenedores** | **Docker (Alpine Linux)** | Contenedor multi-etapa ultra ligero ejecutado en usuario no privilegiado (`node`). |

---

## 🚀 Capacidades y Funcionalidades

### 1. Autenticación y Control de Acceso (RBAC)
- **Roles del Sistema**:
  - `ADMIN`: Control total del sistema, gestión de usuarios y consulta de auditoría.
  - `VETERINARIAN`: Creación y actualización de expedientes médicos y consulta clínica de pacientes.
  - `PET_OWNER`: Registro y consulta de sus propias mascotas y carnets de vacunación.
- **Dual Token Flow**:
  - `AccessToken` de corta duración (1 hora) firmado con HMAC-SHA256.
  - `RefreshToken` de larga duración (7 días) almacenado de forma segura y revocable ante logout.
- **Seed Automático**: Crea automáticamente al inicio el primer administrador (`admin@vetregistro.com`).

### 2. Gestión Integral de Mascotas (`/api/v1/pets`)
- Registro de mascotas vinculado a su propietario mediante identificadores UUID v4.
- Atributos completos: Especie, raza, fecha de nacimiento, sexo, color, peso en kg, fotografía y notas.
- **Control de Microchip Único**: Validación estricta a nivel de índice de base de datos para evitar duplicados.
- Búsqueda, filtrado por especie y paginación optimizada.

### 3. Expediente e Historial Médico (`/api/v1/medical-records`)
- Registro cronológico de consultas, diagnósticos, tratamientos y recetas médicas.
- Seguimiento de próximas citas y alertas de control veterinario.
- Relación directa e íntegra con la mascota mediante borrado en cascada configurado.

### 4. Registro de Auditoría Inmutable (`/api/v1/audit-logs`)
- Bitácora forense de cada operación crítica (creación, edición, eliminación).
- Captura automática de: `userId`, `action`, `resource`, `resourceId`, dirección IP y User-Agent del cliente.

### 5. Blindaje de Seguridad en Producción
- **CORS Dinámico**: Autoriza de forma segura cualquier despliegue en Vercel (`*.vercel.app`) y dominios configurados.
- **Rate Limiting**: Protección contra ataques de fuerza bruta (máximo 5 intentos por minuto en login y registro).
- **Protección de Datos**: Interceptor global que transforma respuestas al estándar `{ success, statusCode, data, timestamp }`.
- **Filtro de Excepciones**: Oculta trazas de error internas en producción para evitar filtración de información sensible.

---

## 📁 Estructura del Proyecto

```text
back-registro-mascotas/
├── src/
│   ├── common/             # Interceptores, filtros de excepción, guards y decoradores globales
│   ├── config/             # Configuración centralizada de variables de entorno y base de datos
│   ├── modules/
│   │   ├── audit-log/      # Módulo de trazabilidad y logs de auditoría
│   │   ├── auth/           # Módulo de login, registro, JWT y refresh tokens
│   │   ├── medical-records/# Módulo de expedientes médicos y visitas clínicas
│   │   ├── pets/           # Módulo de mascotas y fichas veterinarias
│   │   └── users/          # Módulo de usuarios, roles y seeder
│   ├── app.module.ts       # Módulo raíz que ensambla TypeORM, Throttler y módulos de negocio
│   └── main.ts             # Punto de entrada con Helmet, CORS, Swagger y Pipes globales
├── Dockerfile              # Construcción multi-stage en Alpine Linux
├── .dockerignore           # Exclusiones de archivos para la imagen Docker
├── .env.example            # Plantilla de variables de entorno
└── package.json            # Dependencias y scripts de ejecución
```

---

## ⚙️ Variables de Entorno

Crea un archivo `.env` en la raíz del backend tomando como referencia [.env.example](.env.example):

```env
# Servidor
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:4200,https://front-registro-mascotas.vercel.app

# Base de Datos (Supabase o PostgreSQL local)
DATABASE_URL=postgresql://postgres.[PROYECTO]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
DB_SSL=true

# Seguridad JWT
JWT_SECRET=tu-clave-secreta-super-segura-2026
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=tu-clave-refresh-super-segura-2026
JWT_REFRESH_EXPIRES_IN=7d

# Limitador de Tasa (DDoS Protection)
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

---

## 💻 Ejecución Local

### Prerrequisitos
- Node.js 20+ instalado.
- PostgreSQL local o cuenta en Supabase.

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar en modo desarrollo con recarga automática
npm run start:dev

# 3. Compilar para producción
npm run build

# 4. Iniciar bundle de producción
npm run start:prod
```

Una vez iniciado, accede a la documentación interactiva en:
📍 `http://localhost:3000/api/docs`

---

## ☁️ Despliegue en Producción (Render + Docker)

La aplicación incluye un `Dockerfile` optimizado listo para Render:
1. En **Render**, crea un nuevo **Web Service** conectado a tu repositorio de GitHub.
2. Selecciona **Runtime: Docker**.
3. Configura las variables de entorno (`DATABASE_URL`, `DB_SSL=true`, `JWT_SECRET`, etc.).
4. Render compilará el contenedor automáticamente y expondrá la API mediante HTTPS.
