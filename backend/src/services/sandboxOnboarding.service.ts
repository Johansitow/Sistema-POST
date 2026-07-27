/**
 * sandboxOnboardingService — tenants desechables para "Probar configuración".
 *
 * A diferencia del onboarding normal (que aplica flags/configs sobre el tenant
 * activo), aquí cada prueba **crea su propio GrupoNegocio marcado `es_sandbox`**
 * con 1 sede (caso normal) o varias (caso multisede/franquicia), le aplica el
 * perfil elegido y asigna al superadmin como usuario de la(s) sede(s) para que
 * pueda entrar a usarlo. Un sandbox se puede **eliminar por completo** (hard
 * delete de todo su subárbol) sin tocar datos reales.
 *
 * Reutiliza:
 *   - resolverPerfil()               → saber si el perfil es multisede.
 *   - onboardingService.aplicarPerfil → escribe flags/configs (su propia tx).
 *   - buildContexto()                → contextos de FeatureFlagAsignacion a borrar.
 *
 * Multi-tenant: todo queda scopeado a los IDs del sandbox. eliminarSandbox()
 * rechaza cualquier grupo que no sea `es_sandbox` (jamás borra datos reales).
 */

import prisma from '../config/database';
import { resolverPerfil } from '../lib/onboarding/resolverPerfil';
import type { EntradaResolver } from '../lib/onboarding/resolverPerfil';
import { onboardingService } from './onboarding.service';
import { buildContexto } from '../lib/flagContexto';
import { cacheDel } from '../config/redis';
import { NotFoundError, ForbiddenError } from '../exceptions/HttpErrors';

/** Nº de sedes que se crean cuando el perfil es multisede (grupo de restaurantes). */
const SEDES_MULTISEDE = 2;

/** Clave KV donde se guarda el arquetipo de la prueba, para mostrarlo en la lista. */
const SANDBOX_ARQUETIPO_KEY = 'sandbox.arquetipo';

/** ¿El perfil resuelto activa la estructura multi-sede? */
function esMultisede(input: EntradaResolver): boolean {
  const perfil = resolverPerfil(input);
  return perfil.flags.some(f => f.nombre === 'estructura.multisede' && f.habilitado);
}

function nombreSandbox(arquetipo: string | undefined): string {
  const hora = new Date().toISOString().slice(11, 16); // HH:mm (UTC) — solo para diferenciar
  return `Prueba: ${arquetipo ?? 'personalizada'} · ${hora}`;
}

export interface SandboxResumen {
  id_grupo:   number;
  nombre:     string;
  arquetipo:  string | null;
  multisede:  boolean;
  fecha_creacion: Date;
  sedes: { id: number; nombre: string; es_default: boolean }[];
}

export const sandboxOnboardingService = {
  /**
   * crearSandbox — crea el grupo desechable + sede(s), asigna al usuario y aplica
   * el perfil. Devuelve el resumen para que el frontend pueda entrar de inmediato.
   *
   * La creación estructural (grupo + sedes + asignaciones) va en una transacción.
   * aplicarPerfil() se llama después porque abre su propia transacción; si falla,
   * se limpia el sandbox recién creado para no dejar basura.
   */
  async crearSandbox(usuarioId: number, input: EntradaResolver): Promise<SandboxResumen> {
    const multisede = esMultisede(input);          // valida el perfil antes de escribir
    const nSedes    = multisede ? SEDES_MULTISEDE : 1;
    const arquetipo = input.arquetipo ?? null;

    // 1. Estructura atómica: grupo + sedes + asignación del superadmin.
    const { grupo, sedes } = await prisma.$transaction(async (tx) => {
      const grupo = await tx.grupoNegocio.create({
        data: {
          nombre:                nombreSandbox(input.arquetipo),
          es_sandbox:            true,
          plan_max_restaurantes: Math.max(SEDES_MULTISEDE, 3),
        },
      });

      // Guardamos el arquetipo como KV del grupo para poder listarlo luego.
      await tx.configuracionGrupo.create({
        data: { id_grupo: grupo.id, clave: SANDBOX_ARQUETIPO_KEY, valor: arquetipo ?? 'personalizada' },
      });

      const sedes: { id: number; nombre: string; es_default: boolean }[] = [];
      for (let i = 0; i < nSedes; i++) {
        // OJO: `es_default` es global (lo usan findDefault y el fallback de
        // tenantContext). No marcamos ninguna sede sandbox como default para no
        // contaminar la resolución del tenant real. La entrada usa siempre sedes[0].
        const sede = await tx.restaurante.create({
          data: {
            nombre:   nSedes > 1 ? `Sede ${i + 1}` : 'Sede de prueba',
            id_grupo: grupo.id,
          },
          select: { id: true, nombre: true, es_default: true },
        });
        // Vincular al superadmin: así la sede entra en su JWT (restaurantes[]) y
        // tenantContext la puede resolver cuando entre al sandbox.
        await tx.usuarioRestaurante.create({
          data: { id_usuario: usuarioId, id_restaurante: sede.id },
        });
        sedes.push(sede);
      }

      return { grupo, sedes };
    });

    // 2. Aplicar el perfil a cada sede (idempotente a nivel grupo).
    try {
      for (const sede of sedes) {
        await onboardingService.aplicarPerfil(sede.id, grupo.id, input);
      }
    } catch (err) {
      // No dejar un sandbox a medio configurar.
      await this.eliminarSandbox(grupo.id).catch(() => {});
      throw err;
    }

    return {
      id_grupo:       grupo.id,
      nombre:         grupo.nombre,
      arquetipo,
      multisede,
      fecha_creacion: grupo.fecha_creacion,
      sedes,
    };
  },

  /** obtenerSandbox — un sandbox por id de grupo (para entrar). Rechaza no-sandbox. */
  async obtenerSandbox(idGrupo: number): Promise<SandboxResumen> {
    const g = await prisma.grupoNegocio.findUnique({
      where: { id: idGrupo },
      include: {
        restaurantes: {
          select:  { id: true, nombre: true, es_default: true },
          orderBy: { id: 'asc' },
        },
        configuraciones_grupo: {
          where:  { clave: SANDBOX_ARQUETIPO_KEY },
          select: { valor: true },
        },
      },
    });
    if (!g) throw new NotFoundError('Grupo de negocio');
    if (!g.es_sandbox) throw new ForbiddenError('El grupo indicado no es una prueba (sandbox).');

    const arquetipo = g.configuraciones_grupo[0]?.valor ?? null;
    return {
      id_grupo:       g.id,
      nombre:         g.nombre,
      arquetipo:      arquetipo === 'personalizada' ? null : arquetipo,
      multisede:      g.restaurantes.length > 1,
      fecha_creacion: g.fecha_creacion,
      sedes:          g.restaurantes,
    };
  },

  /** listarSandboxes — todas las pruebas activas con sus sedes y arquetipo. */
  async listarSandboxes(): Promise<SandboxResumen[]> {
    const grupos = await prisma.grupoNegocio.findMany({
      where:   { es_sandbox: true },
      orderBy: { fecha_creacion: 'desc' },
      include: {
        restaurantes: {
          select:  { id: true, nombre: true, es_default: true },
          orderBy: { id: 'asc' },
        },
        configuraciones_grupo: {
          where:  { clave: SANDBOX_ARQUETIPO_KEY },
          select: { valor: true },
        },
      },
    });

    return grupos.map(g => {
      const arquetipo = g.configuraciones_grupo[0]?.valor ?? null;
      return {
        id_grupo:       g.id,
        nombre:         g.nombre,
        arquetipo:      arquetipo === 'personalizada' ? null : arquetipo,
        multisede:      g.restaurantes.length > 1,
        fecha_creacion: g.fecha_creacion,
        sedes:          g.restaurantes,
      };
    });
  },

  /**
   * eliminarSandbox — borrado total del tenant de prueba, en una transacción.
   *
   * Guarda de seguridad: solo grupos con `es_sandbox = true`. El sandbox puede
   * haber acumulado datos reales de uso (órdenes, movimientos, caja, catálogo),
   * así que se barre todo el subárbol del tenant en orden hijo → raíz. Las
   * relaciones intra-agregado que ya cascadean (OrdenDetalle/OrdenSede/OrdenEvento
   * ← Orden; ingredientes/fases ← Receta; ítems ← ListaCompras; direcciones/puntos
   * ← Cliente; novedades/detalles ← PeriodoNomina; Configuracion* y UsuarioGrupo/
   * UsuarioRestaurante ← tenant) no se listan aquí.
   */
  async eliminarSandbox(idGrupo: number): Promise<void> {
    const grupo = await prisma.grupoNegocio.findUnique({
      where:  { id: idGrupo },
      select: { id: true, es_sandbox: true, restaurantes: { select: { id: true } } },
    });
    if (!grupo) throw new NotFoundError('Grupo de negocio');
    if (!grupo.es_sandbox) {
      throw new ForbiddenError('Solo se pueden eliminar grupos de prueba (sandbox).');
    }

    const sedeIds   = grupo.restaurantes.map(r => r.id);
    const contextos = [
      buildContexto('grupo', idGrupo),
      ...sedeIds.map(id => buildContexto('restaurante', id)),
    ];

    await prisma.$transaction(async (tx) => {
      const ordenes = await tx.orden.findMany({
        where:  { OR: [{ id_restaurante: { in: sedeIds } }, { id_grupo: idGrupo }] },
        select: { id: true },
      });
      const ordenIds = ordenes.map(o => o.id);

      // ── Hijos de Orden que NO cascadean (Pago, Factura, ClientePunto→id_orden) ──
      if (ordenIds.length) {
        await tx.pago.deleteMany({ where: { id_orden: { in: ordenIds } } });
        await tx.factura.deleteMany({ where: { id_orden: { in: ordenIds } } });
        await tx.clientePunto.deleteMany({ where: { id_orden: { in: ordenIds } } });
      }
      // Puntos de fidelización de clientes del grupo (sin orden asociada)
      await tx.clientePunto.deleteMany({ where: { cliente: { id_grupo: idGrupo } } });

      // Movimientos de inventario (referencian producto/lote/orden/sede)
      await tx.movimiento.deleteMany({ where: { id_restaurante: { in: sedeIds } } });

      // Órdenes (cascada: OrdenDetalle, OrdenSede+ítems, PagoOrden, OrdenEvento)
      if (ordenIds.length) await tx.orden.deleteMany({ where: { id: { in: ordenIds } } });

      // Caja e inventario por sede
      await tx.alerta.deleteMany({ where: { id_restaurante: { in: sedeIds } } });
      await tx.cierreCaja.deleteMany({ where: { id_restaurante: { in: sedeIds } } });
      await tx.turnoCaja.deleteMany({ where: { id_restaurante: { in: sedeIds } } });
      await tx.listaCompras.deleteMany({ where: { id_restaurante: { in: sedeIds } } });
      await tx.lote.deleteMany({ where: { id_restaurante: { in: sedeIds } } });
      await tx.productoStock.deleteMany({ where: { id_restaurante: { in: sedeIds } } });
      await tx.receta.deleteMany({ where: { id_restaurante: { in: sedeIds } } });

      // Catálogo del grupo
      await tx.productoVariante.deleteMany({ where: { producto: { id_grupo: idGrupo } } });
      await tx.proveedorProducto.deleteMany({ where: { producto: { id_grupo: idGrupo } } });
      await tx.producto.deleteMany({ where: { id_grupo: idGrupo } });
      await tx.categoria.deleteMany({ where: { id_grupo: idGrupo } });
      await tx.cliente.deleteMany({ where: { id_grupo: idGrupo } });
      await tx.proveedor.deleteMany({ where: { id_grupo: idGrupo } });

      // Plantillas, documentos, nómina y auditoría del tenant
      await tx.plantillaImpresion.deleteMany({
        where: { OR: [{ id_grupo: idGrupo }, { id_restaurante: { in: sedeIds } }] },
      });
      await tx.documentoEmitido.deleteMany({
        where: { OR: [{ id_grupo: idGrupo }, { id_restaurante: { in: sedeIds } }] },
      });
      await tx.periodoNomina.deleteMany({ where: { id_grupo: idGrupo } });
      await tx.auditoria.deleteMany({
        where: { OR: [{ id_grupo: idGrupo }, { id_restaurante: { in: sedeIds } }] },
      });

      // Asignaciones de feature flags (van por string `contexto`, sin FK)
      await tx.featureFlagAsignacion.deleteMany({ where: { contexto: { in: contextos } } });

      // Empleados cuya sede base sea del sandbox (evita FK al borrar la sede)
      if (sedeIds.length) {
        await tx.usuario.updateMany({
          where: { id_restaurante_base: { in: sedeIds } },
          data:  { id_restaurante_base: null },
        });
      }

      // Sedes (cascada: ConfiguracionRestaurante, UsuarioRestaurante) y grupo
      // (cascada: ConfiguracionGrupo, UsuarioGrupo).
      await tx.restaurante.deleteMany({ where: { id_grupo: idGrupo } });
      await tx.grupoNegocio.delete({ where: { id: idGrupo } });
    });

    await cacheDel('ff:all');
    await cacheDel('restaurantes:all');
  },
};
