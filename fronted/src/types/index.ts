// ============================================================================
// TIPOS GLOBALES - Sistema POS Cocina Oculta
//
// Convención:
// - Los tipos que terminan en 'Dto' son para enviar datos al backend
// - Los tipos que terminan en 'Auth' son para el estado de autenticación
// - Los tipos sin sufijo son entidades completas devueltas por el backend
// ============================================================================

export type EstadoGeneral = 'activo' | 'inactivo' | 'eliminado';
export type TipoMateria   = 'prima' | 'procesada';
export type UnidadMedida  = 'unidad' | 'gramo' | 'kilogramo' | 'litro' | 'mililitro' | 'porcion';
export type TipoOrden     = 'local' | 'domicilio';
export type EstadoFactura = 'pendiente' | 'pagada' | 'anulada';

// ─── AUTH ─────────────────────────────────────────────────────────────────────

/**
 * Rol básico — subconjunto de campos del modelo Rol
 * Usado tanto en UsuarioAuth (token) como en Usuario (entidad completa)
 */
export interface RolBasico {
  id: number;
  nombre: string;
  descripcion?: string;
  color?: string;          // color HEX para avatares y chips
  /** @deprecated Solo para display. NO usar para decisiones de acceso — usar UsuarioAuth.es_super_admin */
  es_super_admin: boolean;
}

/**
 * UsuarioAuth — estructura del payload JWT
 * Debe coincidir exactamente con TokenPayload del backend (auth.service.ts)
 * Solo contiene los campos necesarios para el UI, no datos sensibles
 */
export interface UsuarioAuth {
  id: number;
  uuid: string;
  usuario: string;
  email: string;
  nombre_completo: string; // para mostrar en sidebar y AppBar
  /**
   * Fuente de verdad para super admin — viene de Usuario.es_super_admin en DB (NO del rol).
   * SIEMPRE usar este campo para decisiones de acceso en el frontend.
   */
  es_super_admin: boolean;
  rol: RolBasico;
  /** Restaurantes a los que tiene acceso este usuario (viene del JWT) */
  restaurantes: { id: number; nombre: string; es_default: boolean; id_grupo: number }[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface LoginResponse {
  message: string;
  user: UsuarioAuth;
  tokens: AuthTokens;
}

// ─── USUARIOS ─────────────────────────────────────────────────────────────────

/**
 * Usuario — entidad completa devuelta por /usuarios
 */
export interface Usuario {
  id: number;
  uuid: string;
  nombre_completo: string;
  email: string;
  telefono?: string;
  usuario: string;
  estado: EstadoGeneral;
  /** Inmutable — viene de Usuario.es_super_admin en DB. Solo puede existir uno. */
  es_super_admin: boolean;
  ultimo_acceso?: string;
  fecha_creacion: string;
  fecha_modificacion: string;
  // Datos personales del empleado
  documento_identidad?:          string;
  fecha_nacimiento?:              string;
  direccion?:                     string;
  // Datos laborales
  cargo?:                         string;
  fecha_ingreso?:                 string;
  turno?:                         'mañana' | 'tarde' | 'noche' | 'mixto';
  tipo_contrato?:                 'fijo' | 'parcial' | 'temporal';
  // Contacto de emergencia
  contacto_emergencia_nombre?:    string;
  contacto_emergencia_telefono?:  string;
  // Notas
  notas?:                         string;
  rol: RolBasico & { _count?: { usuarios: number } };
  creador?: {
    id: number;
    nombre_completo: string;
    usuario: string;
  };
}

/** Datos de nómina del empleado */
export interface NominaEmpleado {
  id: number;
  id_usuario: number;
  salario_base: number;
  tipo_pago: 'mensual' | 'quincenal' | 'semanal';
  banco?: string;
  tipo_cuenta?: 'ahorros' | 'corriente';
  numero_cuenta?: string;
  observaciones?: string;
  fecha_modificacion: string;
}

/** Para crear un usuario nuevo — password obligatorio */
export interface CreateUsuarioDto {
  nombre_completo: string;
  email: string;
  usuario: string;
  password: string;
  telefono?: string;
  id_rol: number;
  // Empleado (opcional al crear)
  documento_identidad?:          string;
  fecha_nacimiento?:              string;
  direccion?:                     string;
  cargo?:                         string;
  fecha_ingreso?:                 string;
  turno?:                         string;
  tipo_contrato?:                 string;
  contacto_emergencia_nombre?:    string;
  contacto_emergencia_telefono?:  string;
  notas?:                         string;
}

/** Para editar — password excluido, se cambia por endpoint separado */
export interface UpdateUsuarioDto {
  nombre_completo?: string;
  email?: string;
  telefono?: string;
  id_rol?: number;
  // Empleado
  documento_identidad?:          string;
  fecha_nacimiento?:              string;
  direccion?:                     string;
  cargo?:                         string;
  fecha_ingreso?:                 string;
  turno?:                         string;
  tipo_contrato?:                 string;
  contacto_emergencia_nombre?:    string;
  contacto_emergencia_telefono?:  string;
  notas?:                         string;
}

/** Para guardar/actualizar nómina */
export interface NominaDto {
  salario_base: number;
  tipo_pago: 'mensual' | 'quincenal' | 'semanal';
  banco?: string;
  tipo_cuenta?: 'ahorros' | 'corriente';
  numero_cuenta?: string;
  observaciones?: string;
}

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────

export interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string;
  estado: EstadoGeneral;
}

export interface Producto {
  id: number;
  sku: string;
  nombre: string;
  descripcion?: string;
  tipo_materia: TipoMateria;
  unidad_medida: UnidadMedida;
  precio_unitario: number;
  precio_venta?: number;
  stock_actual: number;
  stock_minimo: number;
  es_vendible: boolean;
  estado: EstadoGeneral;
  categoria?: Categoria;
}

// ─── INVENTARIO ───────────────────────────────────────────────────────────────

export interface InventarioItem extends Producto {
  stockStatus: 'ok' | 'bajo' | 'agotado'; // calculado en frontend
}

// ─── ÓRDENES ──────────────────────────────────────────────────────────────────

export interface EstadoOrden {
  id: number;
  nombre: string;
  codigo: string;
  color?: string;
}

export interface OrdenDetalle {
  id: number;
  id_producto: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  total: number;
  producto?: Producto;
}

export interface Orden {
  id: number;
  numero_orden: string;
  tipo_orden: TipoOrden;
  estado: EstadoOrden;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total: number;
  fecha_apertura: string;
  detalles?: OrdenDetalle[];
}

// ─── PAGINACIÓN ───────────────────────────────────────────────────────────────

/**
 * Respuesta paginada estándar del backend
 * Usar con genérico: PaginatedResponse<Usuario>, PaginatedResponse<Producto>, etc.
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── API RESPONSE ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
}