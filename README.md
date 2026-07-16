# LOGAL Prime · Sistema Contable

Sistema de contabilidad, trazabilidad, estadística y proyección para empresa de transporte corporativo y ejecutivo.

**Stack:** MongoDB · Express · React · Node.js (MERN)

---

## Estructura del Proyecto

```
logal-prime/
├── backend/          # API REST con Express + MongoDB
│   ├── src/
│   │   ├── models/   # Modelos Mongoose
│   │   ├── routes/   # Endpoints API
│   │   └── middleware/
│   └── .env.example
├── frontend/         # App React con Vite
│   ├── src/
│   │   ├── pages/    # Dashboard, Registro, Pagos, Estadísticas...
│   │   ├── context/  # Auth, Vehículos
│   │   └── utils/
│   └── .env.example
└── render.yaml       # Configuración de despliegue Render.com
```

---

## Instalación Local

### Requisitos
- Node.js 18+
- MongoDB Atlas (cuenta gratuita en https://cloud.mongodb.com) o MongoDB local

### 1. Clonar y configurar backend

```bash
cd backend
cp .env.example .env
# Edita .env y agrega tu MONGODB_URI y JWT_SECRET
npm install
npm run dev
```

### 2. Configurar y ejecutar frontend

```bash
cd frontend
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### 3. Crear el primer usuario administrador

En la pantalla de login, haz clic en **"Primera vez? Configurar administrador"** e ingresa:
- Nombre completo
- Usuario (ej: `admin`)
- Contraseña

---

## Despliegue en Render.com (Gratuito)

### Requisitos previos
1. Cuenta en [Render.com](https://render.com)
2. Cuenta en [MongoDB Atlas](https://cloud.mongodb.com) con cluster gratuito (M0)
3. Repositorio en GitHub

### Pasos

**1. Sube el proyecto a GitHub:**
```bash
git init
git add .
git commit -m "LOGAL Prime - Sistema Contable"
git remote add origin https://github.com/TU_USUARIO/logal-prime.git
git push -u origin main
```

**2. En MongoDB Atlas:**
- Crea un cluster gratuito M0
- Crea un usuario de base de datos
- Copia la connection string (formato: `mongodb+srv://...`)
- En Network Access, agrega `0.0.0.0/0` para permitir Render

**3. En Render.com:**
- Dashboard → New → Blueprint
- Conecta tu repositorio GitHub
- Render detectará el `render.yaml` automáticamente
- En el servicio `logal-prime-api`, agrega la variable de entorno:
  - `MONGODB_URI` = tu connection string de Atlas
- Despliega

**4. Tiempo de despliegue:** ~5-10 minutos

---

## Módulos del Sistema

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | KPIs semanales, ingresos vs egresos, margen, proyección |
| **Registro Diario** | Entrada de movimientos: ingresos, combustible, peajes, km |
| **Pagos y Liquidación** | Generación automática de liquidaciones para conductores |
| **Estadísticas** | Histórico mensual, gráficas, proyección a 3 meses |
| **Mantenimiento** | Seguimiento de mantenimientos por vehículo |
| **Vehículos** | Gestión de flota (placa, conductor, km) |

---

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/setup` | Crear primer administrador |
| POST | `/api/auth/login` | Login, retorna JWT |
| GET | `/api/vehicles` | Listar vehículos |
| POST | `/api/registros` | Crear registro diario |
| GET | `/api/stats/dashboard` | KPIs del dashboard |
| GET | `/api/stats/historico` | Datos históricos mensuales |
| POST | `/api/pagos/generar` | Generar liquidación automática |

Todos los endpoints (excepto `/auth/*`) requieren el header:
```
Authorization: Bearer <token>
```

---

## Soporte

Desarrollado con el stack MERN para LOGAL Prime · Transporte Ejecutivo
