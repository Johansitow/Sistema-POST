/**
 * barrerTenant — borra TODO el subárbol de datos de un grupo (tenant) dentro de una
 * transacción, en orden hijo → raíz, y finalmente la(s) sede(s) y el propio grupo.
 *
 * Es el barrido común que usan tanto `eliminarSandbox` (grupos de prueba `es_sandbox`)
 * como `grupoNegocioService.eliminarGrupo` (borrado de un negocio real por el superadmin).
 * Cada llamador pone SUS PROPIAS GUARDAS antes de invocarlo; este helper solo borra.
 *
 * No borra el/los Usuario dueños: sus membresías (UsuarioGrupo/UsuarioRestaurante)
 * cascadean al eliminar el grupo/sedes, pero el registro en `usuarios` sobrevive. Quien
 * necesite borrar también a esos usuarios lo hace después, ya con sus membresías vacías.
 *
 * Las relaciones intra-agregado que ya cascadean (OrdenDetalle/OrdenSede/OrdenEvento ←
 * Orden; ingredientes/fases ← Receta; ítems ← ListaCompras; direcciones/puntos ← Cliente;
 * novedades/detalles ← PeriodoNomina; Configuracion* y UsuarioGrupo/UsuarioRestaurante ←
 * tenant) no se listan aquí.
 */

import { Prisma } from '@prisma/client';

export async function barrerTenant(
  tx: Prisma.TransactionClient,
  idGrupo: number,
  sedeIds: number[],
  contextos: string[],
): Promise<void> {
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

  // Empleados cuya sede base sea del tenant (evita FK al borrar la sede)
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
}
