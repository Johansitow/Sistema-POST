/**
 * routes/index.ts — Registro central de todos los routers
 *
 * Versionado: todos los endpoints viven bajo /api/v1/
 * Para compatibilidad backward se mantienen alias /api/* → /api/v1/*
 */

import { Application, Router } from 'express';
import { tenantRateLimit } from '../middlewares/tenantRateLimit.middleware';

import authRoutes          from './auth.routes';
import usuariosRoutes      from './usuarios.routes';
import productosRoutes     from './productos.routes';
import categoriasRoutes    from './categorias.routes';
import ordenesRoutes       from './ordenes.routes';
import inventarioRoutes    from './inventario.routes';
import dashboardRoutes     from './dashboard.routes';
import reportesRoutes      from './reportes.routes';
import estadosRoutes       from './estados.routes';
import facturasRoutes      from './facturas.routes';
import proveedoresRoutes   from './proveedores.routes';
import alertasRoutes       from './alertas.routes';
import tiposAlertaRoutes   from './tipos-alerta.routes';
import auditoriaRoutes     from './auditoria.routes';
import configuracionRoutes from './configuracion.routes';
import cierreCajaRoutes    from './cierre-caja.routes';
import recetaRoutes        from './receta.routes';
import clientesRoutes      from './clientes.routes';
import metodoPagoRoutes    from './metodo-pago.routes';
import listaComprasRoutes  from './lista-compras.routes';
import variantesRoutes     from './variantes.routes';
import featureFlagsRoutes  from './feature-flags.routes';
import plantillasRoutes    from './plantillas.routes';
import documentosRoutes    from './documentos.routes';
import nominaRoutes        from './nomina.routes';
import restaurantesRoutes  from './restaurante.routes';
import grupoNegocioRoutes  from './grupo-negocio.routes';
import ordenSedesRoutes    from './orden-sedes.routes';
import reciboRoutes        from './recibo.routes';
import uiConfigRoutes      from './ui-config.routes';
import adminRoutes         from './admin.routes';
import onboardingRoutes    from './onboarding.routes';
import menuRoutes          from './menu.routes';

// ─── Router v1 ────────────────────────────────────────────────────────────────
const v1 = Router();

// Rate-limit por tenant — activo para todos los endpoints que tengan req.restauranteId
v1.use(tenantRateLimit());

v1.use('/auth',          authRoutes);
v1.use('/usuarios',      usuariosRoutes);
v1.use('/productos',     productosRoutes);
v1.use('/productos/:productoId/variantes', variantesRoutes);
v1.use('/categorias',    categoriasRoutes);
v1.use('/ordenes',       ordenesRoutes);
v1.use('/inventario',    inventarioRoutes);
v1.use('/dashboard',     dashboardRoutes);
v1.use('/reportes',      reportesRoutes);
v1.use('/estados-orden', estadosRoutes);
v1.use('/facturas',      facturasRoutes);
v1.use('/proveedores',   proveedoresRoutes);
v1.use('/alertas',       alertasRoutes);
v1.use('/tipos-alerta',  tiposAlertaRoutes);
v1.use('/auditoria',     auditoriaRoutes);
v1.use('/configuracion', configuracionRoutes);
v1.use('/caja',          cierreCajaRoutes);
v1.use('/recetas',       recetaRoutes);
v1.use('/clientes',       clientesRoutes);
v1.use('/metodos-pago',   metodoPagoRoutes);
v1.use('/listas-compras', listaComprasRoutes);
v1.use('/feature-flags',  featureFlagsRoutes);
v1.use('/plantillas',     plantillasRoutes);
v1.use('/documentos',     documentosRoutes);
v1.use('/nomina',         nominaRoutes);
v1.use('/restaurantes',   restaurantesRoutes);
v1.use('/grupos',         grupoNegocioRoutes);
v1.use('/orden-sedes',    ordenSedesRoutes);
v1.use('/recibos',        reciboRoutes);
v1.use('/ui-config',      uiConfigRoutes);
v1.use('/admin',          adminRoutes);
v1.use('/onboarding',     onboardingRoutes);
v1.use('/menu',           menuRoutes);

// ─── Exportado como setupRoutes para que coincida con server.ts ───────────────
export const setupRoutes = (app: Application): void => {
  // Versión actual
  app.use('/api/v1', v1);

  // Alias backward-compatible /api/* → /api/v1/* para no romper el frontend actual
  app.use('/api', v1);
};
