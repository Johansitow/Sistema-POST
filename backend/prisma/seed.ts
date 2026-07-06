/**
 * Seed - Datos iniciales para desarrollo
 * Adaptado al schema actual de Cocina Oculta POS
 *
 * Cambios respecto al seed anterior:
 * 1. Agrega permiso 'auditoria.ver' asignado al superadmin
 * 2. Movimientos de tipo 'entrada' ahora incluyen id_proveedor (obligatorio)
 * 3. El movimiento de arroz (sin proveedor) cambió a tipo 'ajuste'
 * 4. Agrega permisos de producción y caja
 * 5. Agrega configuración adicional (umbral caja, prefijos, etc.)
 * 6. Agrega 3 turnos de caja (TurnoCaja)
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // ============================================================
  // LIMPIAR DATOS EXISTENTES (orden correcto por dependencias)
  // ============================================================
  // Nivel 1: Registros de auditoría / alertas (sin dependencias hacia abajo)
  await prisma.auditoria.deleteMany();
  await prisma.alerta.deleteMany();

  // Nivel 2: Pagos y facturas (dependen de orden)
  await prisma.pagoGrupo.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.factura.deleteMany();

  // Nivel 3: Detalles de orden
  await prisma.ordenDetalle.deleteMany();

  // Nivel 4: Puntos y clientes (clientePunto tiene FK nullable a orden sin cascade)
  await prisma.clientePunto.deleteMany();
  await prisma.cliente.deleteMany();       // cascade elimina ClienteDireccion

  // Nivel 5: Órdenes y grupos de órdenes
  await prisma.orden.deleteMany();
  await prisma.ordenGrupo.deleteMany();

  // Nivel 6: Movimientos e inventario
  await prisma.movimiento.deleteMany();
  await prisma.lote.deleteMany();

  // Nivel 7: Lista de compras (FK a producto, proveedor y usuario)
  await prisma.listaComprasItem.deleteMany(); // FK a producto y listaCompras (sin cascade en producto)
  await prisma.listaCompras.deleteMany();     // FK a proveedor y usuario

  // Nivel 8: Recetas y proveedores
  await prisma.recetaIngrediente.deleteMany();
  await prisma.receta.deleteMany();
  await prisma.proveedorProducto.deleteMany();
  await prisma.proveedor.deleteMany();

  // Nivel 9: Variantes y productos (productoVariante tiene FK a producto sin cascade)
  await prisma.productoVariante.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.categoria.deleteMany();

  // Nivel 10: Tablas de configuración / sistema
  await prisma.estadoTransicion.deleteMany();
  await prisma.estadoOrden.deleteMany();
  await prisma.metodoPago.deleteMany();
  await prisma.cierreCaja.deleteMany();
  await prisma.turnoCaja.deleteMany();
  await prisma.tipoAlerta.deleteMany();
  await prisma.configuracion.deleteMany();
  await prisma.featureFlagAsignacion.deleteMany();
  await prisma.featureFlag.deleteMany();
  await prisma.plantillaImpresion.deleteMany();
  await prisma.uiConfiguracion.deleteMany();

  // Nivel 11: Roles y usuarios
  await prisma.usuarioRestaurante.deleteMany();
  await prisma.productoStock.deleteMany();
  await prisma.usuarioGrupo.deleteMany();
  await prisma.restaurante.deleteMany();
  await prisma.grupoNegocio.deleteMany();
  await prisma.rolPermiso.deleteMany();
  await prisma.permiso.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.rol.deleteMany();

  console.log('🗑️  Datos anteriores eliminados');

  // ============================================================
  // ROLES
  // ============================================================
  console.log('👑 Creando roles...');
  const rolAdmin = await prisma.rol.create({
    data: { nombre: 'Administrador', descripcion: 'Acceso total al sistema', es_super_admin: true, es_sistema: true, color: '#FF0000' },
  });
  const rolCajero = await prisma.rol.create({
    data: { nombre: 'Cajero', descripcion: 'Gestión de ventas y caja', color: '#0000FF' },
  });
  const rolCocina = await prisma.rol.create({
    data: { nombre: 'Cocina', descripcion: 'Visualización y gestión de órdenes en cocina', color: '#FFA500' },
  });
  console.log('✅ 3 roles creados');

  // ============================================================
  // PERMISOS
  // ============================================================
  console.log('🔐 Creando permisos...');
  const permisos = await Promise.all([
    prisma.permiso.create({ data: { nombre: 'Ver productos',         codigo: 'productos.ver',      modulo: 'inventario', es_sistema: true } }),
    prisma.permiso.create({ data: { nombre: 'Crear productos',       codigo: 'productos.crear',    modulo: 'inventario', es_sistema: true } }),
    prisma.permiso.create({ data: { nombre: 'Editar productos',      codigo: 'productos.editar',   modulo: 'inventario' } }),
    prisma.permiso.create({ data: { nombre: 'Eliminar productos',    codigo: 'productos.eliminar', modulo: 'inventario' } }),
    prisma.permiso.create({ data: { nombre: 'Ver órdenes',           codigo: 'ordenes.ver',        modulo: 'ventas',     es_sistema: true } }),
    prisma.permiso.create({ data: { nombre: 'Crear órdenes',         codigo: 'ordenes.crear',      modulo: 'ventas' } }),
    prisma.permiso.create({ data: { nombre: 'Cancelar órdenes',      codigo: 'ordenes.cancelar',   modulo: 'ventas' } }),
    prisma.permiso.create({ data: { nombre: 'Ver reportes',          codigo: 'reportes.ver',       modulo: 'reportes' } }),
    prisma.permiso.create({ data: { nombre: 'Gestionar usuarios',    codigo: 'usuarios.gestionar', modulo: 'admin' } }),
    prisma.permiso.create({ data: { nombre: 'Configuración sistema', codigo: 'config.sistema',     modulo: 'admin' } }),
    prisma.permiso.create({ data: {
      nombre: 'Ver auditoría', codigo: 'auditoria.ver', modulo: 'admin', es_sistema: true,
      descripcion: 'Acceso al historial de auditoría del sistema. Solo el superadmin lo tiene por defecto.',
    }}),
  ]);

  // Permisos nuevos de producción, caja y clientes
  const permisosNuevos = await Promise.all([
    prisma.permiso.create({ data: { nombre: 'Ver recetas',              codigo: 'recetas.ver',              modulo: 'produccion' } }),
    prisma.permiso.create({ data: { nombre: 'Gestionar recetas',        codigo: 'recetas.gestionar',        modulo: 'produccion' } }),
    prisma.permiso.create({ data: { nombre: 'Ver fases de receta',      codigo: 'recetas.fases',            modulo: 'produccion' } }),
    prisma.permiso.create({ data: { nombre: 'Ver cierres caja',         codigo: 'caja.ver',                 modulo: 'reportes'  } }),
    prisma.permiso.create({ data: { nombre: 'Realizar cierres',         codigo: 'caja.cerrar',              modulo: 'reportes'  } }),
    prisma.permiso.create({ data: { nombre: 'Gestionar turnos',         codigo: 'caja.turnos',              modulo: 'admin', es_sistema: true } }),
    prisma.permiso.create({ data: { nombre: 'Ver listas de compras',    codigo: 'listas_compras.ver',       modulo: 'compras' } }),
    prisma.permiso.create({ data: { nombre: 'Gestionar listas compras', codigo: 'listas_compras.gestionar', modulo: 'compras' } }),
    prisma.permiso.create({ data: { nombre: 'Ver clientes',             codigo: 'clientes.ver',             modulo: 'ventas', es_sistema: true } }),
    prisma.permiso.create({ data: { nombre: 'Gestionar clientes',       codigo: 'clientes.gestionar',       modulo: 'ventas' } }),
  ]);
  console.log('✅ Permisos de producción, caja, compras y clientes agregados');

  const permisosOnboarding = await Promise.all([
    prisma.permiso.create({ data: { nombre: 'Aplicar onboarding', codigo: 'onboarding.aplicar', modulo: 'admin', descripcion: 'Ejecutar el wizard de configuración inicial de una sede' } }),
  ]);
  console.log('✅ Permiso onboarding.aplicar creado');

  const todosLosPermisos = [...permisos, ...permisosNuevos, ...permisosOnboarding];

  // Admin recibe TODOS los permisos
  await Promise.all(
    todosLosPermisos.map(p => prisma.rolPermiso.create({ data: { id_rol: rolAdmin.id, id_permiso: p.id } }))
  );

  // Cajero: ventas + inventario ver + caja + clientes
  const permisosCajero = todosLosPermisos.filter(p =>
    ['ordenes.ver', 'ordenes.crear', 'ordenes.cancelar', 'productos.ver', 'caja.ver', 'caja.cerrar', 'clientes.ver', 'clientes.gestionar'].includes(p.codigo)
  );
  await Promise.all(
    permisosCajero.map(p => prisma.rolPermiso.create({ data: { id_rol: rolCajero.id, id_permiso: p.id } }))
  );

  // Cocina: solo ver órdenes y productos
  const permisosCocina = todosLosPermisos.filter(p =>
    ['ordenes.ver', 'productos.ver'].includes(p.codigo)
  );
  await Promise.all(
    permisosCocina.map(p => prisma.rolPermiso.create({ data: { id_rol: rolCocina.id, id_permiso: p.id } }))
  );

  console.log('✅ Permisos creados y asignados');

  // ============================================================
  // USUARIOS
  // ============================================================
  console.log('👤 Creando usuarios...');
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  // ─── SUPER ADMIN ÚNICO ────────────────────────────────────────────────────
  // UUID fijo que identifica al superadmin en el sistema.
  // DEBE coincidir con SUPER_ADMIN_UUID en el archivo .env.
  // NUNCA cambiar este UUID en producción.
  const SUPER_ADMIN_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  const usuarioAdmin = await prisma.usuario.create({
    data: {
      uuid:            SUPER_ADMIN_UUID,  // UUID fijo e inmutable
      nombre_completo: 'Administrador Sistema',
      email:           'admin@cocinaoculta.com',
      usuario:         'admin',
      password_hash:   passwordHash,
      id_rol:          rolAdmin.id,
      telefono:        '3001234567',
      es_super_admin:  true,              // flag de identidad del superadmin único
    },
  });
  await prisma.usuario.create({
    data: { nombre_completo: 'Carlos Cajero', email: 'cajero@cocinaoculta.com', usuario: 'cajero1', password_hash: await bcrypt.hash('Cajero123!', 10), id_rol: rolCajero.id, creado_por: usuarioAdmin.id },
  });
  await prisma.usuario.create({
    data: { nombre_completo: 'María Cocina', email: 'cocina@cocinaoculta.com', usuario: 'cocina1', password_hash: await bcrypt.hash('Cocina123!', 10), id_rol: rolCocina.id, creado_por: usuarioAdmin.id },
  });
  console.log('✅ 3 usuarios creados');

  // ============================================================
  // GRUPO DE NEGOCIO (raíz del tenant SaaS)
  // ============================================================
  console.log('🏢 Creando grupo de negocio...');
  const grupoPrincipal = await prisma.grupoNegocio.create({
    data: {
      nombre: 'Cocina Oculta Group',
      nit:    '900123456-0',
      plan:   'starter',
      activo: true,
    },
  });
  console.log('✅ Grupo de negocio creado');

  // ============================================================
  // RESTAURANTES + ASIGNACIONES DE USUARIOS
  // ============================================================
  console.log('🍽️  Creando restaurantes...');
  const [restPrincipal, restSucursal] = await Promise.all([
    prisma.restaurante.create({
      data: {
        nombre:      'Cocina Oculta — Sede Principal',
        nit:         '900123456-1',
        descripcion: 'Sede principal del restaurante',
        direccion:   'Calle 85 #13-25, Bogotá',
        ciudad:      'Bogotá',
        telefono:    '3001234567',
        email:       'principal@cocinaoculta.com',
        es_default:  true,
        activo:      true,
        id_grupo:    grupoPrincipal.id,
      },
    }),
    prisma.restaurante.create({
      data: {
        nombre:      'Cocina Oculta — Sucursal Norte',
        descripcion: 'Sucursal zona norte',
        direccion:   'Carrera 15 #120-60, Bogotá',
        ciudad:      'Bogotá',
        telefono:    '3009876543',
        email:       'norte@cocinaoculta.com',
        es_default:  false,
        activo:      true,
        id_grupo:    grupoPrincipal.id,
      },
    }),
  ]);
  console.log('✅ 2 restaurantes creados');

  // Asignar usuarios a restaurantes
  // admin → ambas sedes | cajero1 → principal | cocina1 → principal
  const cajeroUser = await prisma.usuario.findUnique({ where: { usuario: 'cajero1' } });
  const cocinaUser = await prisma.usuario.findUnique({ where: { usuario: 'cocina1' } });

  await Promise.all([
    prisma.usuarioRestaurante.create({ data: { id_usuario: usuarioAdmin.id, id_restaurante: restPrincipal.id } }),
    prisma.usuarioRestaurante.create({ data: { id_usuario: usuarioAdmin.id, id_restaurante: restSucursal.id } }),
    prisma.usuarioRestaurante.create({ data: { id_usuario: cajeroUser!.id,  id_restaurante: restPrincipal.id } }),
    prisma.usuarioRestaurante.create({ data: { id_usuario: cocinaUser!.id,  id_restaurante: restPrincipal.id } }),
  ]);
  console.log('✅ Usuarios asignados a restaurantes');

  // Asignar admin al grupo como owner
  await prisma.usuarioGrupo.create({
    data: { id_usuario: usuarioAdmin.id, id_grupo: grupoPrincipal.id, rol_en_grupo: 'owner' },
  });
  console.log('✅ Admin asignado al grupo de negocio');

  // ============================================================
  // CONFIGURACIÓN POR RESTAURANTE (ConfiguracionRestaurante)
  // ============================================================
  console.log('⚙️  Creando configuración por restaurante...');
  await Promise.all([
    // Sede principal
    prisma.configuracionRestaurante.create({ data: { id_restaurante: restPrincipal.id, clave: 'puntos_por_unidad',    valor: '1000'  } }),
    prisma.configuracionRestaurante.create({ data: { id_restaurante: restPrincipal.id, clave: 'iva_porcentaje',       valor: '19'    } }),
    prisma.configuracionRestaurante.create({ data: { id_restaurante: restPrincipal.id, clave: 'general.moneda',       valor: 'COP'   } }),
    prisma.configuracionRestaurante.create({ data: { id_restaurante: restPrincipal.id, clave: 'puntos_bienvenida',    valor: '50'    } }),
    prisma.configuracionRestaurante.create({ data: { id_restaurante: restPrincipal.id, clave: 'costo_domicilio',      valor: '5000'  } }),
    // Sucursal norte
    prisma.configuracionRestaurante.create({ data: { id_restaurante: restSucursal.id,  clave: 'puntos_por_unidad',    valor: '1000'  } }),
    prisma.configuracionRestaurante.create({ data: { id_restaurante: restSucursal.id,  clave: 'iva_porcentaje',       valor: '19'    } }),
    prisma.configuracionRestaurante.create({ data: { id_restaurante: restSucursal.id,  clave: 'general.moneda',       valor: 'COP'   } }),
    prisma.configuracionRestaurante.create({ data: { id_restaurante: restSucursal.id,  clave: 'puntos_bienvenida',    valor: '50'    } }),
    prisma.configuracionRestaurante.create({ data: { id_restaurante: restSucursal.id,  clave: 'costo_domicilio',      valor: '5000'  } }),
  ]);
  console.log('✅ Configuración por restaurante creada');

  // ============================================================
  // CONFIGURACIÓN
  // ============================================================
  console.log('⚙️  Creando configuración...');
  await Promise.all([
    // Originales
    prisma.configuracion.create({ data: { clave: 'nombre_negocio',    valor: 'Cocina Oculta', tipo_dato: 'string',  categoria: 'general',     descripcion: 'Nombre del negocio' } }),
    prisma.configuracion.create({ data: { clave: 'nit_negocio',       valor: '900123456-1',   tipo_dato: 'string',  categoria: 'general',     descripcion: 'NIT del negocio' } }),
    prisma.configuracion.create({ data: { clave: 'porcentaje_iva',    valor: '19',            tipo_dato: 'number',  categoria: 'facturacion', descripcion: 'Porcentaje de IVA' } }),
    prisma.configuracion.create({ data: { clave: 'general.moneda',    valor: 'COP',           tipo_dato: 'string',  categoria: 'general',     descripcion: 'Moneda del sistema (default global; sedes usan ConfiguracionRestaurante)' } }),
    prisma.configuracion.create({ data: { clave: 'prefijo_orden',     valor: 'ORD',           tipo_dato: 'string',  categoria: 'ventas',      descripcion: 'Prefijo para número de órdenes' } }),
    prisma.configuracion.create({ data: { clave: 'alerta_stock_activa', valor: 'true',        tipo_dato: 'boolean', categoria: 'inventario',  descripcion: 'Activar alertas de stock mínimo' } }),
    // Nuevas
    prisma.configuracion.create({ data: { clave: 'umbral_diferencia_caja',     valor: '5000',       tipo_dato: 'number',  categoria: 'caja',        descripcion: 'Diferencia máxima permitida en cierre de caja sin justificación (COP)' } }),
    prisma.configuracion.create({ data: { clave: 'margen_rentabilidad_minimo', valor: '40',         tipo_dato: 'number',  categoria: 'produccion',  descripcion: 'Margen mínimo de rentabilidad para recetas (%)' } }),
    prisma.configuracion.create({ data: { clave: 'prefijo_cierre',             valor: 'CIE',        tipo_dato: 'string',  categoria: 'caja',        descripcion: 'Prefijo para número de cierres de caja',  es_editable: false } }),
    prisma.configuracion.create({ data: { clave: 'prefijo_factura',            valor: 'FAC',        tipo_dato: 'string',  categoria: 'facturacion', descripcion: 'Prefijo para número de facturas',         es_editable: false } }),
    prisma.configuracion.create({ data: { clave: 'dias_alerta_vencimiento',    valor: '7',          tipo_dato: 'number',  categoria: 'inventario',  descripcion: 'Días antes del vencimiento para generar alerta de lote' } }),
    prisma.configuracion.create({ data: { clave: 'telefono_negocio',           valor: '3001234567', tipo_dato: 'string',  categoria: 'general',     descripcion: 'Teléfono del negocio' } }),
    prisma.configuracion.create({ data: { clave: 'ciudad_negocio',             valor: 'Bogotá',     tipo_dato: 'string',  categoria: 'general',     descripcion: 'Ciudad del negocio' } }),
    // Nuevas configuraciones de lista de compras y ajuste de stock
    prisma.configuracion.create({ data: { clave: 'LISTA_COMPRAS_AUTO',    valor: 'true', tipo_dato: 'boolean', categoria: 'inventario', descripcion: 'Generar lista de compras automáticamente cuando el stock llega al mínimo' } }),
    prisma.configuracion.create({ data: { clave: 'STOCK_AJUSTE_AUTO',     valor: 'true', tipo_dato: 'boolean', categoria: 'inventario', descripcion: 'Ajustar automáticamente stock mínimo/máximo según tendencias de ventas' } }),
    prisma.configuracion.create({ data: { clave: 'LISTA_COMPRAS_LEAD_DAYS', valor: '3', tipo_dato: 'number',  categoria: 'inventario', descripcion: 'Días de lead time del proveedor para calcular stock mínimo (días de anticipación)' } }),
    prisma.configuracion.create({ data: { clave: 'costo_domicilio_defecto', valor: '5000', tipo_dato: 'number', categoria: 'ventas', descripcion: 'Costo de domicilio por defecto al crear una orden' } }),
    // Defaults globales del wizard de onboarding (fallback cuando no hay override de sede/grupo)
    prisma.configuracion.create({ data: { clave: 'ordenes.modelo_servicio',      valor: 'mostrador',    tipo_dato: 'string',  categoria: 'onboarding', descripcion: 'Modelo de servicio por defecto' } }),
    prisma.configuracion.create({ data: { clave: 'facturacion.tipo',             valor: 'ticket',       tipo_dato: 'string',  categoria: 'onboarding', descripcion: 'Tipo de documento de cobro por defecto' } }),
    prisma.configuracion.create({ data: { clave: 'facturacion.impuesto_tipo',    valor: 'impoconsumo',  tipo_dato: 'string',  categoria: 'onboarding', descripcion: 'Tipo de impuesto (impoconsumo 8% para restaurantes; iva 19% para franquicias — ET art. 512-1)' } }),
    prisma.configuracion.create({ data: { clave: 'facturacion.impuesto_tarifa',  valor: '8',            tipo_dato: 'number',  categoria: 'onboarding', descripcion: 'Tarifa del impuesto en % (editable después del onboarding)' } }),
  ]);
  console.log('✅ Configuración creada (originales + nuevas + defaults wizard)');

  // ============================================================
  // TURNOS DE CAJA
  // ============================================================
  console.log('🕐 Creando turnos de caja...');
  const [turnoManana, turnoTarde, turnoUnico] = await Promise.all([
    prisma.turnoCaja.create({ data: { nombre: 'Turno Mañana', hora_apertura: '07:00', hora_cierre: '15:00', dias_semana: [1,2,3,4,5,6] } }),
    prisma.turnoCaja.create({ data: { nombre: 'Turno Tarde',  hora_apertura: '15:00', hora_cierre: '23:00', dias_semana: [1,2,3,4,5,6] } }),
    prisma.turnoCaja.create({ data: { nombre: 'Turno Único',  hora_apertura: '10:00', hora_cierre: '22:00', dias_semana: [0]           } }),
  ]);
  console.log('✅ 3 turnos de caja creados');

  // ============================================================
  // ESTADOS DE ORDEN
  // ============================================================
  console.log('📋 Creando estados de orden...');
  const estadoPendiente = await prisma.estadoOrden.create({
    data: { nombre: 'Pendiente', codigo: 'PENDIENTE', descripcion: 'Orden recibida', color: '#FFC107', icono: 'clock', orden: 1, es_inicial: true, permite_edicion: true, es_sistema: true },
  });
  const estadoEnPreparacion = await prisma.estadoOrden.create({
    data: { nombre: 'En Preparación', codigo: 'EN_PREPARACION', descripcion: 'Orden en cocina', color: '#2196F3', icono: 'chef', orden: 2, imprime_comanda: true, es_sistema: true },
  });
  const estadoLista = await prisma.estadoOrden.create({
    data: { nombre: 'Lista', codigo: 'LISTA', descripcion: 'Orden lista para entregar', color: '#4CAF50', icono: 'check', orden: 3, es_sistema: true },
  });
  const estadoEntregada = await prisma.estadoOrden.create({
    data: { nombre: 'Entregada', codigo: 'ENTREGADA', descripcion: 'Orden entregada al cliente', color: '#9E9E9E', icono: 'delivery', orden: 4, es_final: true, permite_edicion: false, es_sistema: true },
  });
  const estadoCancelada = await prisma.estadoOrden.create({
    data: { nombre: 'Cancelada', codigo: 'CANCELADA', descripcion: 'Orden cancelada', color: '#F44336', icono: 'cancel', orden: 5, es_final: true, permite_edicion: false, es_sistema: true },
  });

  await Promise.all([
    prisma.estadoTransicion.create({ data: { id_estado_desde: estadoPendiente.id,     id_estado_hacia: estadoEnPreparacion.id, orden: 1 } }),
    prisma.estadoTransicion.create({ data: { id_estado_desde: estadoPendiente.id,     id_estado_hacia: estadoCancelada.id,     orden: 2 } }),
    prisma.estadoTransicion.create({ data: { id_estado_desde: estadoEnPreparacion.id, id_estado_hacia: estadoLista.id,         orden: 1 } }),
    prisma.estadoTransicion.create({ data: { id_estado_desde: estadoEnPreparacion.id, id_estado_hacia: estadoCancelada.id,     orden: 2 } }),
    prisma.estadoTransicion.create({ data: { id_estado_desde: estadoLista.id,         id_estado_hacia: estadoEntregada.id,     orden: 1 } }),
  ]);
  console.log('✅ 5 estados de orden y transiciones creadas');

  // ============================================================
  // MÉTODOS DE PAGO
  // ============================================================
  console.log('💳 Creando métodos de pago...');
  const metodoPagos = await Promise.all([
    prisma.metodoPago.create({ data: { nombre: 'Efectivo',        codigo: 'EFECTIVO',  icono: 'cash',        es_sistema: true, orden: 1 } }),
    prisma.metodoPago.create({ data: { nombre: 'Tarjeta Débito',  codigo: 'DEBITO',    icono: 'card',        requiere_referencia: true, orden: 2 } }),
    prisma.metodoPago.create({ data: { nombre: 'Tarjeta Crédito', codigo: 'CREDITO',   icono: 'credit-card', requiere_referencia: true, orden: 3 } }),
    prisma.metodoPago.create({ data: { nombre: 'Nequi',           codigo: 'NEQUI',     icono: 'phone',       requiere_referencia: true, orden: 4 } }),
    prisma.metodoPago.create({ data: { nombre: 'Daviplata',       codigo: 'DAVIPLATA', icono: 'phone',       requiere_referencia: true, orden: 5 } }),
  ]);
  console.log('✅ 5 métodos de pago creados');

  // ============================================================
  // TIPOS DE ALERTA
  // ============================================================
  console.log('🔔 Creando tipos de alerta...');
  await Promise.all([
    prisma.tipoAlerta.create({ data: { nombre: 'Stock Mínimo',       codigo: 'STOCK_MINIMO',     descripcion: 'Producto por debajo del stock mínimo',         icono: 'warning',     color: '#FFC107', prioridad_default: 'alta',    es_sistema: true } }),
    prisma.tipoAlerta.create({ data: { nombre: 'Stock Agotado',      codigo: 'STOCK_AGOTADO',    descripcion: 'Producto sin stock',                           icono: 'error',       color: '#F44336', prioridad_default: 'critica', es_sistema: true } }),
    prisma.tipoAlerta.create({ data: { nombre: 'Vencimiento',        codigo: 'VENCIMIENTO',      descripcion: 'Lote próximo a vencer (≤ 7 días)',             icono: 'calendar',    color: '#FF5722', prioridad_default: 'alta',    es_sistema: true } }),
    prisma.tipoAlerta.create({ data: { nombre: 'Lista de Compras',   codigo: 'LISTA_COMPRA',     descripcion: 'Lista de compras generada automáticamente',    icono: 'shopping_cart', color: '#FF9800', prioridad_default: 'alta',  es_sistema: true } }),
    prisma.tipoAlerta.create({ data: { nombre: 'Ajuste Stock',       codigo: 'AJUSTE_STOCK',     descripcion: 'Stock mínimo/máximo ajustado por tendencias',  icono: 'tune',        color: '#2196F3', prioridad_default: 'media' } }),
  ]);
  console.log('✅ 5 tipos de alerta creados');

  // ============================================================
  // CATEGORÍAS
  // ============================================================
  console.log('📁 Creando categorías...');
  const [catCarnes, catVerduras, catLacteos, catGranos, catBebidas, catSalsas] = await Promise.all([
    prisma.categoria.create({ data: { nombre: 'Carnes',               descripcion: 'Productos cárnicos',             orden: 1 } }),
    prisma.categoria.create({ data: { nombre: 'Verduras',             descripcion: 'Verduras y hortalizas',          orden: 2 } }),
    prisma.categoria.create({ data: { nombre: 'Lácteos',              descripcion: 'Productos lácteos',              orden: 3 } }),
    prisma.categoria.create({ data: { nombre: 'Granos',               descripcion: 'Granos y legumbres',             orden: 4 } }),
    prisma.categoria.create({ data: { nombre: 'Bebidas',              descripcion: 'Bebidas y refrescos',            orden: 5 } }),
    prisma.categoria.create({ data: { nombre: 'Salsas y Condimentos', descripcion: 'Salsas, aderezos y condimentos', orden: 6 } }),
  ]);
  console.log('✅ 6 categorías creadas');

  // ============================================================
  // PRODUCTOS
  // ============================================================
  console.log('📦 Creando productos...');
  const productos = await Promise.all([
    prisma.producto.create({ data: { sku: 'CARNE-001', nombre: 'Pechuga de Pollo',       id_categoria: catCarnes.id,   tipo_materia: 'prima',     unidad_medida: 'kilogramo', precio_unitario: 12000, stock_actual: 50,  stock_minimo: 10, requiere_refrigeracion: true } }),
    prisma.producto.create({ data: { sku: 'CARNE-002', nombre: 'Carne Molida de Res',    id_categoria: catCarnes.id,   tipo_materia: 'prima',     unidad_medida: 'kilogramo', precio_unitario: 18000, stock_actual: 30,  stock_minimo: 5,  requiere_refrigeracion: true } }),
    prisma.producto.create({ data: { sku: 'CARNE-003', nombre: 'Tocino',                 id_categoria: catCarnes.id,   tipo_materia: 'prima',     unidad_medida: 'kilogramo', precio_unitario: 22000, stock_actual: 15,  stock_minimo: 3,  requiere_refrigeracion: true } }),
    prisma.producto.create({ data: { sku: 'VERD-001',  nombre: 'Tomate',                 id_categoria: catVerduras.id, tipo_materia: 'prima',     unidad_medida: 'kilogramo', precio_unitario: 3500,  stock_actual: 25,  stock_minimo: 10 } }),
    prisma.producto.create({ data: { sku: 'VERD-002',  nombre: 'Cebolla Cabezona',       id_categoria: catVerduras.id, tipo_materia: 'prima',     unidad_medida: 'kilogramo', precio_unitario: 2500,  stock_actual: 40,  stock_minimo: 15 } }),
    prisma.producto.create({ data: { sku: 'VERD-003',  nombre: 'Lechuga',                id_categoria: catVerduras.id, tipo_materia: 'prima',     unidad_medida: 'unidad',    precio_unitario: 1500,  stock_actual: 20,  stock_minimo: 8 } }),
    prisma.producto.create({ data: { sku: 'VERD-004',  nombre: 'Papa',                   id_categoria: catVerduras.id, tipo_materia: 'prima',     unidad_medida: 'kilogramo', precio_unitario: 2000,  stock_actual: 60,  stock_minimo: 20 } }),
    prisma.producto.create({ data: { sku: 'LACT-001',  nombre: 'Queso Mozzarella',       id_categoria: catLacteos.id,  tipo_materia: 'prima',     unidad_medida: 'kilogramo', precio_unitario: 25000, stock_actual: 15,  stock_minimo: 5,  requiere_refrigeracion: true } }),
    prisma.producto.create({ data: { sku: 'LACT-002',  nombre: 'Leche Entera',           id_categoria: catLacteos.id,  tipo_materia: 'prima',     unidad_medida: 'litro',     precio_unitario: 4500,  stock_actual: 30,  stock_minimo: 10, requiere_refrigeracion: true } }),
    prisma.producto.create({ data: { sku: 'GRANO-001', nombre: 'Arroz Blanco',           id_categoria: catGranos.id,   tipo_materia: 'prima',     unidad_medida: 'kilogramo', precio_unitario: 3000,  stock_actual: 100, stock_minimo: 20 } }),
    prisma.producto.create({ data: { sku: 'GRANO-002', nombre: 'Frijol Rojo',            id_categoria: catGranos.id,   tipo_materia: 'prima',     unidad_medida: 'kilogramo', precio_unitario: 4500,  stock_actual: 45,  stock_minimo: 15 } }),
    prisma.producto.create({ data: { sku: 'BEB-001',   nombre: 'Coca Cola 1.5L',         id_categoria: catBebidas.id,  tipo_materia: 'procesada', unidad_medida: 'unidad',    precio_unitario: 4000,  precio_venta: 6000,  stock_actual: 60, stock_minimo: 20, es_vendible: true } }),
    prisma.producto.create({ data: { sku: 'BEB-002',   nombre: 'Agua Embotellada 600ml', id_categoria: catBebidas.id,  tipo_materia: 'procesada', unidad_medida: 'unidad',    precio_unitario: 1500,  precio_venta: 2500,  stock_actual: 80, stock_minimo: 30, es_vendible: true } }),
    prisma.producto.create({ data: { sku: 'BEB-003',   nombre: 'Jugo Hit 1L',            id_categoria: catBebidas.id,  tipo_materia: 'procesada', unidad_medida: 'unidad',    precio_unitario: 3500,  precio_venta: 5500,  stock_actual: 40, stock_minimo: 15, es_vendible: true } }),
    prisma.producto.create({ data: { sku: 'SALSA-001', nombre: 'Aceite Vegetal',         id_categoria: catSalsas.id,   tipo_materia: 'prima',     unidad_medida: 'litro',     precio_unitario: 8000,  stock_actual: 20,  stock_minimo: 5 } }),
    prisma.producto.create({ data: { sku: 'SALSA-002', nombre: 'Salsa de Tomate',        id_categoria: catSalsas.id,   tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 6000,  stock_actual: 15,  stock_minimo: 5 } }),
  ]);

  const platoHamburguesa = await prisma.producto.create({
    data: { sku: 'PLATO-001', nombre: 'Hamburguesa Clásica', id_categoria: catCarnes.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 15000, precio_venta: 25000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Hamburguesa con carne, lechuga, tomate y queso' },
  });
  const platoArroz = await prisma.producto.create({
    data: { sku: 'PLATO-002', nombre: 'Bandeja Paisa', id_categoria: catGranos.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 18000, precio_venta: 32000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Bandeja paisa tradicional' },
  });
  console.log(`✅ ${productos.length + 2} productos creados`);

  // ============================================================
  // RECETAS
  // ============================================================
  console.log('📝 Creando recetas...');
  await prisma.receta.create({
    data: {
      id_producto_final: platoHamburguesa.id, nombre_receta: 'Hamburguesa Clásica',
      descripcion: 'Receta base para hamburguesa clásica', cantidad_producida: 1, unidad_produccion: 'porcion',
      tiempo_preparacion: 15, merma_esperada_porcentaje: 5,
      id_restaurante: restPrincipal.id,
      ingredientes: { create: [
        { id_producto: productos[1].id, cantidad: 0.15, unidad: 'kilogramo', orden: 1 },
        { id_producto: productos[7].id, cantidad: 0.05, unidad: 'kilogramo', orden: 2 },
        { id_producto: productos[5].id, cantidad: 0.1,  unidad: 'unidad',    orden: 3 },
        { id_producto: productos[3].id, cantidad: 0.05, unidad: 'kilogramo', orden: 4 },
      ]},
    },
  });
  await prisma.receta.create({
    data: {
      id_producto_final: platoArroz.id, nombre_receta: 'Bandeja Paisa Tradicional',
      descripcion: 'Receta completa de bandeja paisa', cantidad_producida: 1, unidad_produccion: 'porcion',
      tiempo_preparacion: 45,
      id_restaurante: restPrincipal.id,
      ingredientes: { create: [
        { id_producto: productos[10].id, cantidad: 0.15, unidad: 'kilogramo', orden: 1 },
        { id_producto: productos[9].id,  cantidad: 0.15, unidad: 'kilogramo', orden: 2 },
        { id_producto: productos[1].id,  cantidad: 0.1,  unidad: 'kilogramo', orden: 3 },
        { id_producto: productos[2].id,  cantidad: 0.08, unidad: 'kilogramo', orden: 4 },
      ]},
    },
  });
  console.log('✅ 2 recetas creadas');

  // ============================================================
  // PROVEEDORES
  // ============================================================
  console.log('🏪 Creando proveedores...');
  const proveedor1 = await prisma.proveedor.create({
    data: { razon_social: 'Carnes y Más S.A.S', nit: '900111222-3', contacto_nombre: 'Pedro Ramírez', contacto_telefono: '3109876543', contacto_email: 'ventas@carnesymas.com', ciudad: 'Bogotá', calificacion: 4.5, tiempo_entrega_promedio: 2 },
  });
  const proveedor2 = await prisma.proveedor.create({
    data: { razon_social: 'Distribuidora La Cosecha', nit: '800333444-5', contacto_nombre: 'Ana García', contacto_telefono: '3201112233', contacto_email: 'pedidos@lacosecha.com', ciudad: 'Medellín', calificacion: 4.8, tiempo_entrega_promedio: 1 },
  });
  await Promise.all([
    prisma.proveedorProducto.create({ data: { id_proveedor: proveedor1.id, id_producto: productos[0].id, precio_unitario: 11500, es_proveedor_preferido: true, tiempo_entrega: 2 } }),
    prisma.proveedorProducto.create({ data: { id_proveedor: proveedor1.id, id_producto: productos[1].id, precio_unitario: 17000, es_proveedor_preferido: true, tiempo_entrega: 2 } }),
    prisma.proveedorProducto.create({ data: { id_proveedor: proveedor2.id, id_producto: productos[3].id, precio_unitario: 3200,  es_proveedor_preferido: true, tiempo_entrega: 1 } }),
    prisma.proveedorProducto.create({ data: { id_proveedor: proveedor2.id, id_producto: productos[4].id, precio_unitario: 2300,  es_proveedor_preferido: true, tiempo_entrega: 1 } }),
    prisma.proveedorProducto.create({ data: { id_proveedor: proveedor2.id, id_producto: productos[9].id, precio_unitario: 2800,  es_proveedor_preferido: true, tiempo_entrega: 1 } }),
  ]);
  console.log('✅ 2 proveedores creados');

  // ============================================================
  // LOTES Y MOVIMIENTOS
  // ============================================================
  console.log('📦 Creando lotes y movimientos de inventario...');
  const lote1 = await prisma.lote.create({
    data: { numero_lote: 'LOTE-000001', id_producto: productos[0].id, cantidad_producida: 50, fecha_vencimiento: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), id_restaurante: restPrincipal.id },
  });
  const lote2 = await prisma.lote.create({
    data: { numero_lote: 'LOTE-000002', id_producto: productos[1].id, cantidad_producida: 30, fecha_vencimiento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), id_restaurante: restPrincipal.id },
  });

  await Promise.all([
    prisma.movimiento.create({ data: { id_producto: productos[0].id,  tipo_movimiento: 'entrada', cantidad: 50,  stock_anterior: 0,  stock_nuevo: 50,  motivo: 'Compra inicial',              id_proveedor: proveedor1.id, id_lote: lote1.id, id_restaurante: restPrincipal.id } }),
    prisma.movimiento.create({ data: { id_producto: productos[1].id,  tipo_movimiento: 'entrada', cantidad: 30,  stock_anterior: 0,  stock_nuevo: 30,  motivo: 'Compra inicial',              id_proveedor: proveedor1.id, id_lote: lote2.id, id_restaurante: restPrincipal.id } }),
    prisma.movimiento.create({ data: { id_producto: productos[9].id,  tipo_movimiento: 'ajuste',  cantidad: 100, stock_anterior: 0,  stock_nuevo: 100, motivo: 'Ajuste inicial de inventario',                                                 id_restaurante: restPrincipal.id } }),
    prisma.movimiento.create({ data: { id_producto: productos[11].id, tipo_movimiento: 'venta',   cantidad: 2,   stock_anterior: 62, stock_nuevo: 60,  motivo: 'Venta orden ORD-000001',                                                       id_restaurante: restPrincipal.id } }),
  ]);
  console.log('✅ Lotes y movimientos creados');

  // ============================================================
  // ÓRDENES DE EJEMPLO
  // ============================================================
  console.log('🛒 Creando órdenes de ejemplo...');
  const orden1 = await prisma.orden.create({
    data: {
      numero_orden: 'ORD-000001', tipo_orden: 'local',
      id_estado: estadoEntregada.id, id_usuario: usuarioAdmin.id,
      subtotal: 57000, impuestos: 10830, total: 67830,
      fecha_apertura:    new Date(Date.now() - 3600000),
      fecha_confirmacion: new Date(Date.now() - 3300000),
      fecha_entrega:     new Date(Date.now() - 1800000),
      detalles: { create: [
        { id_producto: platoHamburguesa.id, cantidad: 2, precio_unitario: 25000, subtotal: 50000, total: 50000 },
        { id_producto: productos[11].id,    cantidad: 2, precio_unitario: 3500,  subtotal: 7000,  total: 7000  },
      ]},
    },
  });
  await prisma.pago.create({ data: { id_orden: orden1.id, id_metodo_pago: metodoPagos[0].id, monto: 67830 } });
  await prisma.factura.create({ data: { id_orden: orden1.id, numero_factura: 'FAC-000001', estado_factura: 'pagada', subtotal: 57000, impuestos: 10830, total: 67830, fecha_pago: new Date() } });

  await prisma.orden.create({
    data: {
      numero_orden: 'ORD-000002', tipo_orden: 'domicilio',
      id_estado: estadoPendiente.id, id_usuario: usuarioAdmin.id,
      nombre_contacto: 'Juan Pérez', telefono_contacto: '3001234567',
      direccion_entrega: 'Calle 123 #45-67, Bogotá', costo_domicilio: 5000,
      subtotal: 32000, impuestos: 6080, total: 43080, fecha_apertura: new Date(),
      detalles: { create: [
        { id_producto: platoArroz.id, cantidad: 1, precio_unitario: 32000, subtotal: 32000, total: 32000 },
      ]},
    },
  });
  console.log('✅ 2 órdenes de ejemplo creadas');

  // ============================================================
  // FEATURE FLAGS
  // ============================================================
  const defaultFlags = [
    { nombre: 'variantes_productos',  descripcion: 'Permite crear variantes/presentaciones por producto',    habilitado: true  },
    { nombre: 'lotes_produccion',      descripcion: 'Módulo de lotes de producción e inventario avanzado',   habilitado: true  },
    { nombre: 'listas_compras',        descripcion: 'Generación automática de listas de compras',            habilitado: true  },
    { nombre: 'clientes_fidelizacion', descripcion: 'Sistema de puntos y fidelización de clientes',          habilitado: true  },
    { nombre: 'recetas',               descripcion: 'Módulo de recetas y costos de producción',              habilitado: true  },
    { nombre: 'multi_restaurante',     descripcion: 'Gestión de múltiples restaurantes/sucursales',          habilitado: true  },
    { nombre: 'plantillas_impresion',  descripcion: 'Plantillas configurables para tickets y comandas',      habilitado: true  },
    { nombre: 'cierre_caja_avanzado',  descripcion: 'Cierres de caja con turnos y conciliación',            habilitado: true  },
    { nombre: 'reportes_avanzados',    descripcion: 'Reportes de rentabilidad, merma y tendencias',          habilitado: false },
    // Wizard de onboarding: marcador de completitud (scope=contexto → por restaurante)
    { nombre: 'onboarding_completado',         descripcion: 'El restaurante completó el wizard de configuración inicial', habilitado: true,  scope: 'contexto' },
    // Flags escritos por el wizard (scope=contexto, todos inician en off; el apply los activa por sede/grupo)
    { nombre: 'modulo.mesas',                  descripcion: 'Campo mesa habilitado en órdenes (módulo parcial: sin gestor de salón)', habilitado: false, scope: 'contexto' },
    { nombre: 'ordenes.propina',               descripcion: 'Campo propina habilitado en creación de órdenes',                       habilitado: false, scope: 'contexto' },
    { nombre: 'modulo.inventario',             descripcion: 'Módulo de control de inventario',                                       habilitado: false, scope: 'contexto' },
    { nombre: 'inventario.lotes',              descripcion: 'Inventario con lotes y control de vencimiento',                         habilitado: false, scope: 'contexto' },
    { nombre: 'inventario.descuento_auto',     descripcion: 'Descuento automático en stock al registrar ventas',                     habilitado: false, scope: 'contexto' },
    { nombre: 'modulo.recetas',                descripcion: 'Módulo de recetas y costos de producción (definición a nivel grupo)',   habilitado: false, scope: 'contexto' },
    { nombre: 'recetas.fases',                 descripcion: 'Fases de producción en recetas — KDS por estaciones',                  habilitado: false, scope: 'contexto' },
    { nombre: 'modulo.facturas',               descripcion: 'Módulo de facturación formal',                                         habilitado: false, scope: 'contexto' },
    { nombre: 'modulo.caja',                   descripcion: 'Módulo de turnos y cierres de caja',                                   habilitado: false, scope: 'contexto' },
    { nombre: 'modulo.clientes',               descripcion: 'Módulo de registro y gestión de clientes (Eje 6, dueño único)',         habilitado: false, scope: 'contexto' },
    { nombre: 'modulo.fidelizacion',           descripcion: 'Sistema de puntos y fidelización — activa LoyaltyPlugin',              habilitado: false, scope: 'contexto' },
    { nombre: 'estructura.multisede',          descripcion: 'Grupo con múltiples sedes activas',                                    habilitado: false, scope: 'contexto' },
    { nombre: 'modulo.reportes_consolidados',  descripcion: 'Reportes consolidados entre sedes del grupo',                          habilitado: false, scope: 'contexto' },
  ];
  for (const flag of defaultFlags) {
    await prisma.featureFlag.create({ data: flag });
  }
  console.log(`✅ ${defaultFlags.length} feature flags creados`);

  // ============================================================
  // PRODUCTO STOCK (inventario por restaurante)
  // ============================================================
  console.log('📊 Creando stocks por restaurante...');
  const todosProductos = [...productos, platoHamburguesa, platoArroz];
  await Promise.all(
    todosProductos.map(p =>
      prisma.productoStock.create({
        data: {
          id_producto:    p.id,
          id_restaurante: restPrincipal.id,
          stock_actual:   p.stock_actual,
          stock_minimo:   p.stock_minimo,
          precio_venta_local: p.precio_venta ?? null,
          activo: true,
        },
      })
    )
  );
  console.log(`✅ ${todosProductos.length} registros de stock creados para la sede principal`);

  // ============================================================
  // RESUMEN FINAL
  // ============================================================
  console.log('\n✨ ¡Seed completado exitosamente!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👤 Usuarios:');
  console.log('   admin   / Admin123!   → Administrador (superadmin)');
  console.log('   cajero1 / Cajero123!  → Cajero');
  console.log('   cocina1 / Cocina123!  → Cocina');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 Permisos nuevos: recetas.ver, recetas.gestionar, caja.ver, caja.cerrar, caja.turnos');
  console.log('🕐 Turnos de caja: Turno Mañana (07-15), Turno Tarde (15-23), Turno Único dom (10-22)');
  console.log('⚙️  Configuración global: umbral_diferencia_caja, prefijo_cierre, prefijo_factura...');
  console.log('🏪 Configuración por restaurante: puntos_por_unidad=1000, iva_porcentaje=19, costo_domicilio=5000...');
  console.log('📦 Lotes: LOTE-000001 (Pollo, vence en 5d), LOTE-000002 (Carne Molida, vence en 7d)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error('❌ Error en seed:', e); await prisma.$disconnect(); process.exit(1); });