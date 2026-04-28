# 🍔 Sistema POS para Restaurante

Sistema completo de punto de venta (POS) para restaurantes con gestión de inventario, ventas, producción y reportes.

## 📋 Características Principales

- ✅ Gestión de Inventario (Materias primas y productos procesados)
- ✅ Sistema de Recetas y Control de Producción
- ✅ Punto de Venta con múltiples métodos de pago
- ✅ Control de Proveedores y Órdenes de Compra
- ✅ Sistema de Alertas (Stock bajo, vencimientos)
- ✅ Reportes y Análisis de Ventas
- ✅ Cierre de Caja
- ✅ Auditoría completa del sistema
- ✅ Multi-rol (Administrador, Cajero, Mesero, Cocinero)

## 🛠 Stack Tecnológico

### Backend
- **Node.js** + **TypeScript**
- **Express.js** (Framework web)
- **Prisma ORM** (Base de datos)
- **PostgreSQL** (Base de datos)
- **JWT** (Autenticación)
- **Zod** (Validación de datos)
- **Winston** (Logging)

### Frontend
- **React 18** + **TypeScript**
- **Vite** (Build tool)
- **React Router v6** (Navegación)
- **Zustand** (State management)
- **TanStack Query** (Data fetching)
- **Tailwind CSS** (Estilos)
- **Shadcn/ui** (Componentes UI)
- **Axios** (HTTP client)

## 📁 Estructura del Proyecto

```
pos-restaurante/
├── backend/                    # Servidor Node.js + Express
│   ├── prisma/                # Prisma schema y migraciones
│   ├── src/
│   │   ├── config/            # Configuraciones
│   │   ├── controllers/       # Controladores por módulo
│   │   ├── dto/               # Data Transfer Objects
│   │   ├── exceptions/        # Manejo de errores
│   │   ├── lib/               # Utilidades
│   │   ├── middlewares/       # Middlewares (auth, validación)
│   │   ├── repositories/      # Capa de datos
│   │   ├── routes/            # Rutas de la API
│   │   ├── services/          # Lógica de negocio
│   │   ├── types/             # Tipos TypeScript
│   │   └── server.ts          # Punto de entrada
│   └── package.json
│
└── fronted/                    # Aplicación React
    ├── public/                # Archivos estáticos
    ├── src/
    │   ├── assets/            # Imágenes, iconos
    │   ├── components/        # Componentes reutilizables
    │   │   ├── common/        # Componentes comunes
    │   │   ├── layout/        # Layout components
    │   │   ├── inventario/    # Componentes de inventario
    │   │   ├── ordenes/       # Componentes de órdenes
    │   │   └── reportes/      # Componentes de reportes
    │   ├── hooks/             # Custom hooks
    │   ├── pages/             # Páginas/Vistas principales
    │   ├── services/          # Servicios API
    │   ├── store/             # Zustand stores
    │   ├── types/             # Tipos TypeScript
    │   ├── utils/             # Utilidades
    │   └── App.tsx            # Componente principal
    └── package.json
```

## 🚀 Instalación y Configuración

### Requisitos Previos
- Node.js >= 18.x
- PostgreSQL >= 14.x
- npm o pnpm

### 1. Clonar el repositorio
```bash
git clone <repo-url>
cd pos-restaurante
```

### 2. Configurar Backend

```bash
cd backend
npm install

# Configurar variables de entorno
cp .env.example .env

# Editar .env con tus credenciales de base de datos
```

**Archivo .env:**
```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/pos_restaurante"
JWT_SECRET="tu_secreto_super_seguro_aqui"
JWT_EXPIRES_IN="24h"
PORT=3000
NODE_ENV=development
```

### 3. Configurar Base de Datos

```bash
# Crear la base de datos con el script SQL proporcionado
psql -U postgres -f database/pos_database_schema.sql

# Generar cliente Prisma
npx prisma generate

# Aplicar migraciones
npx prisma migrate dev
```

### 4. Configurar Frontend

```bash
cd ../fronted
npm install

# Configurar variables de entorno
cp .env.example .env

# Editar .env
```

**Archivo .env:**
```env
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME="POS Restaurante"
```

### 5. Iniciar el Proyecto

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd fronted
npm run dev
```

La aplicación estará disponible en:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## 👤 Usuario Inicial

- **Usuario:** admin
- **Contraseña:** admin123
- **Email:** admin@restaurant.com

⚠️ **IMPORTANTE:** Cambiar esta contraseña en producción.

## 📚 Módulos del Sistema

### 1. Administración
- Gestión de usuarios y roles
- Configuración del sistema
- Auditoría de acciones

### 2. Inventario
- Productos y materias primas
- Categorías
- Recetas de producción
- Control de stock
- Alertas de stock bajo y vencimientos
- Movimientos de inventario

### 3. Ventas
- Punto de venta (POS)
- Órdenes/Comandas
- Facturación
- Múltiples métodos de pago
- Propinas

### 4. Producción
- Lotes de producción
- Control de mermas
- Trazabilidad

### 5. Proveedores
- Gestión de proveedores
- Órdenes de compra
- Comparación de precios

### 6. Reportes
- Cierres de caja
- Ventas por período
- Productos más vendidos
- Análisis de inventario

## 🔒 Seguridad

- ✅ Autenticación JWT
- ✅ Encriptación de contraseñas con bcrypt
- ✅ Validación de datos con Zod
- ✅ Protección contra SQL injection (Prisma)
- ✅ Rate limiting
- ✅ CORS configurado
- ✅ Headers de seguridad (Helmet)

## 📊 API Endpoints

### Autenticación
```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/profile
POST   /api/auth/refresh
```

### Inventario
```
GET    /api/inventario/productos
POST   /api/inventario/productos
PUT    /api/inventario/productos/:id
DELETE /api/inventario/productos/:id
GET    /api/inventario/alertas
```

### Ventas
```
POST   /api/ventas/ordenes
GET    /api/ventas/ordenes/:id
PUT    /api/ventas/ordenes/:id/estado
POST   /api/ventas/facturas
```

### Reportes
```
GET    /api/reportes/ventas/diarias
GET    /api/reportes/productos-vendidos
POST   /api/reportes/cierre-caja
```

## 🧪 Testing

```bash
# Backend
cd backend
npm test

# Frontend
cd fronted
npm test
```

## 📦 Deployment

### Backend
```bash
npm run build
npm start
```

### Frontend
```bash
npm run build
# Los archivos estarán en dist/
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT.

## 📧 Contacto

Para soporte: soporte@restaurant.com

---

Desarrollado con ❤️ para la industria restaurantera