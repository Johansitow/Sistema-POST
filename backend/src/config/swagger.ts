/**
 * swagger.ts — Configuración de Swagger / OpenAPI 3.0
 *
 * Documentación disponible en: GET /api/docs
 * JSON spec en:                GET /api/docs.json
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'POS Cocina Oculta — API',
      version:     '1.0.0',
      description: 'API REST del sistema de punto de venta para Cocina Oculta. Autenticación mediante JWT Bearer token.',
      contact: {
        name: 'Equipo de desarrollo',
      },
    },
    servers: [
      { url: 'http://localhost:3000/api/v1', description: 'Desarrollo local v1' },
      { url: 'http://localhost:3000/api',    description: 'Desarrollo local (alias)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
          description:  'Token JWT obtenido desde POST /auth/login',
        },
      },
      schemas: {
        // ── Respuesta estándar paginada ───────────────────────────────────────
        PaginatedMeta: {
          type: 'object',
          properties: {
            total:      { type: 'integer', example: 100 },
            page:       { type: 'integer', example: 1 },
            limit:      { type: 'integer', example: 20 },
            totalPages: { type: 'integer', example: 5 },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data:    { description: 'Payload de la respuesta' },
            message: { type: 'string', example: 'Operación exitosa' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error:   { type: 'string',  example: 'Recurso no encontrado' },
            details: { type: 'array', items: { type: 'object' }, description: 'Errores de validación (solo en 422)' },
          },
        },
        // ── Auth ─────────────────────────────────────────────────────────────
        LoginRequest: {
          type: 'object',
          required: ['usuario', 'password'],
          properties: {
            usuario:  { type: 'string', example: 'admin' },
            password: { type: 'string', example: 'password123' },
          },
        },
        TokenPair: {
          type: 'object',
          properties: {
            accessToken:  { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn:    { type: 'string', example: '24h' },
          },
        },
        // ── Variante ─────────────────────────────────────────────────────────
        ProductoVariante: {
          type: 'object',
          properties: {
            id:          { type: 'integer', example: 1 },
            id_producto: { type: 'integer', example: 5 },
            nombre:      { type: 'string',  example: 'Grande' },
            precio:      { type: 'number',  example: 5000 },
            sku:         { type: 'string',  example: 'VAR-001', nullable: true },
            atributos:   { type: 'object',  nullable: true, description: 'JSON libre: { color, talla, … }' },
            orden:       { type: 'integer', example: 0 },
            estado:      { type: 'string',  example: 'activo' },
          },
        },
        VarianteCreate: {
          type: 'object',
          required: ['nombre', 'precio'],
          properties: {
            nombre:    { type: 'string', example: 'Grande' },
            precio:    { type: 'number', example: 5000 },
            sku:       { type: 'string', example: 'VAR-001' },
            atributos: { type: 'object', description: 'JSON libre' },
          },
        },
        VarianteUpdate: {
          type: 'object',
          properties: {
            nombre:    { type: 'string' },
            precio:    { type: 'number' },
            sku:       { type: 'string', nullable: true },
            atributos: { type: 'object' },
          },
        },
        ReordenarItem: {
          type: 'object',
          required: ['id', 'orden'],
          properties: {
            id:    { type: 'integer' },
            orden: { type: 'integer', minimum: 0 },
          },
        },
        // ── Feature Flag ─────────────────────────────────────────────────────
        FeatureFlag: {
          type: 'object',
          properties: {
            id:          { type: 'integer',  example: 1 },
            nombre:      { type: 'string',   example: 'variantes_productos' },
            descripcion: { type: 'string',   example: 'Activa el módulo de variantes', nullable: true },
            habilitado:  { type: 'boolean',  example: true },
            scope:       { type: 'string',   enum: ['global', 'contexto'], example: 'global' },
            metadata:    { type: 'object',   nullable: true },
            asignaciones: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  contexto:   { type: 'string', example: 'restaurante_1' },
                  habilitado: { type: 'boolean' },
                },
              },
            },
          },
        },
        FeatureFlagCreate: {
          type: 'object',
          required: ['nombre'],
          properties: {
            nombre:      { type: 'string', pattern: '^[a-z_]+$', example: 'variantes_productos' },
            descripcion: { type: 'string' },
            habilitado:  { type: 'boolean', default: false },
            scope:       { type: 'string', enum: ['global', 'contexto'], default: 'global' },
            metadata:    { type: 'object' },
          },
        },
        // ── Plantilla ────────────────────────────────────────────────────────
        PlantillaImpresion: {
          type: 'object',
          properties: {
            id:         { type: 'integer', example: 1 },
            nombre:     { type: 'string',  example: 'Ticket estándar' },
            tipo:       { type: 'string',  enum: ['ticket', 'factura', 'comanda'], example: 'ticket' },
            es_default: { type: 'boolean', example: false },
            plantilla:  { type: 'object',  description: 'JSON con la estructura de la plantilla' },
            estado:     { type: 'string',  example: 'activo' },
          },
        },
        PlantillaCreate: {
          type: 'object',
          required: ['nombre', 'tipo', 'plantilla'],
          properties: {
            nombre:     { type: 'string', example: 'Ticket estándar' },
            tipo:       { type: 'string', enum: ['ticket', 'factura', 'comanda'] },
            es_default: { type: 'boolean', default: false },
            plantilla:  { type: 'object' },
          },
        },
        // ── UI Config ────────────────────────────────────────────────────────
        UiConfiguracion: {
          type: 'object',
          properties: {
            id:       { type: 'integer', example: 1 },
            scope:    { type: 'string',  example: 'theme' },
            clave:    { type: 'string',  example: 'primary_color' },
            valor:    { description: 'Valor JSON libre', example: '#ff5722' },
            contexto: { type: 'string',  example: 'restaurante_1', nullable: true },
          },
        },
        // ── Cliente ──────────────────────────────────────────────────────────
        ClienteCreate: {
          type: 'object',
          required: ['nombre_completo'],
          properties: {
            nombre_completo:   { type: 'string', example: 'María García' },
            email:             { type: 'string', format: 'email' },
            telefono:          { type: 'string', example: '3001234567' },
            tipo_cliente:      { type: 'string', enum: ['regular','frecuente','vip','corporativo','delivery'] },
            puntos_bienvenida: { type: 'boolean', default: false },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth',        description: 'Autenticación y sesión' },
      { name: 'Dashboard',   description: 'Métricas y estadísticas generales' },
      { name: 'Productos',   description: 'Gestión del catálogo de productos' },
      { name: 'Categorías',  description: 'Categorías de productos' },
      { name: 'Órdenes',     description: 'Gestión de órdenes y tickets' },
      { name: 'Inventario',  description: 'Movimientos de stock e inventario' },
      { name: 'Clientes',    description: 'Gestión de clientes y programa de puntos' },
      { name: 'Proveedores', description: 'Gestión de proveedores' },
      { name: 'Facturas',    description: 'Facturación y pagos' },
      { name: 'Recetas',     description: 'Recetas de producción' },
      { name: 'Caja',        description: 'Turnos y cierres de caja' },
      { name: 'Reportes',    description: 'Reportes y análisis de ventas' },
      { name: 'Alertas',     description: 'Sistema de alertas' },
      { name: 'Auditoría',     description: 'Registro de auditoría' },
      { name: 'Usuarios',      description: 'Gestión de usuarios y roles (admin)' },
      { name: 'Configuración', description: 'Configuración del sistema (admin)' },
      { name: 'Variantes',     description: 'Variantes de productos (talla, color, etc.)' },
      { name: 'Feature Flags', description: 'Activación/desactivación de funcionalidades en tiempo real' },
      { name: 'Plantillas',    description: 'Plantillas de impresión de tickets, facturas y comandas' },
      { name: 'UI Config',     description: 'Configuraciones dinámicas de interfaz por scope/clave' },
    ],
  },
  // Rutas donde swagger-jsdoc buscará anotaciones JSDoc con @openapi
  apis: ['./src/routes/*.ts', './src/controller/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
