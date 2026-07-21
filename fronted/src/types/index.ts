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
  /** Permisos efectivos: rol (RolPermiso) ∪ directos (UsuarioPermiso) — vacío para superadmin (bypasea todo) */
  permisos: string[];
  /** Grupos donde el usuario es owner/admin — habilita el panel de administración de grupo */
  grupos_admin?: { id_grupo: number; rol_en_grupo: string }[];
  rol: RolBasico;
  /** Restaurantes a los que tiene acceso este usuario (viene del JWT) */
  restaurantes: { id: number; nombre: string; es_default: boolean; id_grupo: number }[];
}

/**
 * PerfilUsuario — respuesta de GET /auth/profile (selectPublico del backend).
 * Más rica que el JWT (datos personales/laborales) pero SIN restaurantes:
 * las sedes asignadas se leen del JWT (useAuthStore().user.restaurantes).
 */
export interface PerfilUsuario {
  id: number;
  uuid: string;
  usuario: string;
  email: string;
  nombre_completo: string;
  telefono?: string | null;
  estado: string;
  ultimo_acceso?: string | null;
  fecha_creacion?: string;
  es_super_admin: boolean;
  rol: RolBasico;
  // Datos personales / laborales (opcionales)
  documento_identidad?: string | null;
  fecha_nacimiento?: string | null;
  direccion?: string | null;
  cargo?: string | null;
  fecha_ingreso?: string | null;
  turno?: string | null;
  tipo_contrato?: string | null;
  contacto_emergencia_nombre?: string | null;
  contacto_emergencia_telefono?: string | null;
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
// ─── EMPLEADO ─────────────────────────────────────────────────────────────────

export type TipoDocumento  = 'cc' | 'ce' | 'nit' | 'pasaporte' | 'sin_documento';
export type Turno          = 'mañana' | 'tarde' | 'noche' | 'mixto';
export type TipoContrato   = 'indefinido' | 'fijo' | 'obra_labor' | 'aprendizaje';
export type Jornada        = 'completa' | 'parcial' | 'por_horas';
export type NivelRiesgoARL = 'I' | 'II' | 'III' | 'IV' | 'V';

/**
 * Estado LABORAL — independiente de `estado`, que es el de la cuenta de acceso.
 * Un empleado en vacaciones conserva cuenta activa; uno retirado conserva
 * su ficha e historial aunque pierda el acceso.
 */
export type EstadoLaboral =
  | 'activo' | 'periodo_prueba' | 'vacaciones' | 'incapacidad'
  | 'licencia' | 'suspendido' | 'retirado';

/**
 * Campos de empleado — fuente única de verdad.
 * Usuario, CreateUsuarioDto y UpdateUsuarioDto los reutilizan en vez de
 * repetir la lista tres veces (antes se desincronizaban con facilidad).
 * Admiten null para poder LIMPIAR un dato desde el formulario.
 */
export interface EmpleadoFields {
  // Personales
  tipo_documento?:               TipoDocumento | null;
  documento_identidad?:          string | null;
  fecha_nacimiento?:             string | null;
  direccion?:                    string | null;
  foto_url?:                     string | null;
  // Laborales
  cargo?:                        string | null;
  fecha_ingreso?:                string | null;
  turno?:                        Turno | null;
  tipo_contrato?:                TipoContrato | null;
  jornada?:                      Jornada | null;
  estado_laboral?:               EstadoLaboral;
  fecha_retiro?:                 string | null;
  motivo_retiro?:                string | null;
  id_restaurante_base?:          number | null;
  id_jefe_directo?:              number | null;
  // Seguridad social
  eps?:                          string | null;
  afp?:                          string | null;
  arl?:                          string | null;
  nivel_riesgo_arl?:             NivelRiesgoARL | null;
  fondo_cesantias?:              string | null;
  caja_compensacion?:            string | null;
  // Contacto de emergencia
  contacto_emergencia_nombre?:   string | null;
  contacto_emergencia_telefono?: string | null;
  // Notas internas del administrador
  notas?:                        string | null;
}

export interface Usuario extends EmpleadoFields {
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
  /** Consecutivo EMP-#### generado por grupo al crear el empleado. */
  codigo_empleado?: string | null;
  rol: RolBasico & { _count?: { usuarios: number } };
  creador?: {
    id: number;
    nombre_completo: string;
    usuario: string;
  };
  jefe_directo?: {
    id: number;
    nombre_completo: string;
    cargo?: string | null;
  } | null;
  /** Sede que asume el costo laboral — ancla de tenant para nómina. */
  restaurante_base?: {
    id: number;
    nombre: string;
    id_grupo: number;
  } | null;
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

/**
 * Para crear un usuario nuevo — password obligatorio.
 * El código de empleado NO se envía: lo genera el backend por grupo.
 */
export interface CreateUsuarioDto extends EmpleadoFields {
  nombre_completo: string;
  email: string;
  usuario: string;
  password: string;
  telefono?: string;
  id_rol: number;
}

/** Para editar — password excluido, se cambia por endpoint separado */
export interface UpdateUsuarioDto extends EmpleadoFields {
  nombre_completo?: string;
  email?: string;
  telefono?: string;
  id_rol?: number;
}

/** Para guardar/actualizar nómina */
export interface NominaDto {
  salario_base: number;
  tipo_pago: 'mensual' | 'quincenal' | 'semanal';
  banco?: string;
  tipo_cuenta?: 'ahorros' | 'corriente';
  numero_cuenta?: string;
  observaciones?: string;
  /** Metadatos del cambio — alimentan el historial salarial, no la nómina */
  vigencia_desde?: string;
  motivo?: string;
}

/**
 * Registro del historial salarial. Se escribe automáticamente en el backend
 * cada vez que cambia el salario o la frecuencia de pago.
 */
export interface HistorialSalario {
  id: number;
  id_usuario: number;
  salario_anterior: number | null;
  salario_nuevo: number;
  tipo_pago: 'mensual' | 'quincenal' | 'semanal';
  vigencia_desde: string;
  motivo?: string | null;
  fecha_registro: string;
  registrado_por?: {
    id: number;
    nombre_completo: string;
  } | null;
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