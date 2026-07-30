/**
 * RegistroService — alta self-serve de un negocio nuevo (embudo gratis).
 *
 * Cualquiera puede registrarse desde la web pública y queda con:
 *   - un GrupoNegocio propio en plan `starter` (Gratis),
 *   - su primera sede,
 *   - un usuario DUEÑO (rol "Propietario" + UsuarioGrupo.owner) con acceso total
 *     a SU grupo (nunca a otros: el scope lo dan tenantContext + UsuarioGrupo),
 *   - el consentimiento de Habeas Data (Ley 1581) guardado como config del grupo.
 *
 * Reutiliza:
 *   - authService.emitirSesion → emite el par de tokens sin re-login.
 *   - catálogo de planes        → tope de sedes del plan starter.
 *
 * Seguridad: es un endpoint PÚBLICO. No crea superadmins ni asigna es_super_admin
 * (ese flag solo existe en el seed con UUID fijo). El rol "Propietario" reúne los
 * permisos operativos y de administración de grupo, pero `requireAdminAccess`
 * acota cada módulo al grupo del usuario, así que un dueño jamás ve otro tenant.
 */

import bcrypt from 'bcrypt';
import { RolGrupo } from '@prisma/client';
import prisma from '../config/database';
import { authService } from './auth.service';
import { tokenAuthService } from './tokenAuth.service';
import { emailService, plantillaVerificacion } from './email.service';
import { config } from '../config/env';
import { getPlan } from '../lib/planes/catalogo';
import { ConflictError } from '../exceptions/HttpErrors';

/** Nombre del rol operativo del dueño de un negocio auto-registrado. */
const ROL_PROPIETARIO = 'Propietario';

export interface RegistroInput {
  nombre_negocio: string;
  nombre_completo: string;
  email: string;
  usuario: string;
  password: string;
  acepta_habeas_data: boolean;
}

export interface RegistroContext {
  ip?: string;
  userAgent?: string;
}

/**
 * asegurarRolPropietario — rol global (compartido por todos los dueños), creado
 * la primera vez con TODOS los permisos del sistema. No es superadmin: no existe
 * un "permiso de superadmin" (ese poder viene del flag es_super_admin del
 * usuario, que aquí nunca se asigna). El poder del rol queda acotado al grupo del
 * dueño por los middlewares de tenant/admin.
 */
async function asegurarRolPropietario(): Promise<number> {
  const existente = await prisma.rol.findUnique({ where: { nombre: ROL_PROPIETARIO } });
  if (existente) return existente.id;

  const rol = await prisma.rol.create({
    data: {
      nombre: ROL_PROPIETARIO,
      descripcion: 'Dueño del negocio: acceso total a su propio grupo',
      es_sistema: true,
      color: '#16a34a',
    },
  });

  const permisos = await prisma.permiso.findMany({ select: { id: true } });
  if (permisos.length) {
    await prisma.rolPermiso.createMany({
      data: permisos.map(p => ({ id_rol: rol.id, id_permiso: p.id })),
      skipDuplicates: true,
    });
  }
  return rol.id;
}

export const registroService = {
  async registrar(input: RegistroInput, ctx: RegistroContext = {}) {
    // Unicidad ANTES de abrir la transacción (mismos mensajes que usuarioService).
    const [existeEmail, existeUsuario] = await Promise.all([
      prisma.usuario.findUnique({ where: { email: input.email } }),
      prisma.usuario.findUnique({ where: { usuario: input.usuario } }),
    ]);
    if (existeEmail) throw new ConflictError('El email ya está registrado');
    if (existeUsuario) throw new ConflictError('El nombre de usuario ya está en uso');

    const idRolPropietario = await asegurarRolPropietario();
    const password_hash = await bcrypt.hash(input.password, 10);
    const planStarter = getPlan('starter');

    // Estructura completa del tenant en una sola transacción (todo o nada).
    const { usuarioCreado } = await prisma.$transaction(async (tx) => {
      const grupo = await tx.grupoNegocio.create({
        data: {
          nombre: input.nombre_negocio,
          plan: 'starter',
          plan_max_restaurantes: planStarter.limites.max_sedes,
        },
      });

      // La primera sede NO se marca es_default: esa bandera es global (la usan
      // findDefault y el fallback de tenantContext) y no debe pisar el default
      // del sistema. El dueño accede a su sede vía UsuarioRestaurante (va en su JWT).
      const sede = await tx.restaurante.create({
        data: { nombre: input.nombre_negocio, id_grupo: grupo.id },
      });

      const usuario = await tx.usuario.create({
        data: {
          nombre_completo: input.nombre_completo,
          email: input.email,
          usuario: input.usuario,
          password_hash,
          id_rol: idRolPropietario,
          codigo_empleado: 'EMP-0001', // grupo nuevo → primer consecutivo
          id_restaurante_base: sede.id,
        },
      });

      await tx.usuarioGrupo.create({
        data: { id_usuario: usuario.id, id_grupo: grupo.id, rol_en_grupo: RolGrupo.owner },
      });
      await tx.usuarioRestaurante.create({
        data: { id_usuario: usuario.id, id_restaurante: sede.id },
      });

      // Consentimiento Habeas Data (Ley 1581) — base legal del carril de datos.
      await tx.configuracionGrupo.create({
        data: {
          id_grupo: grupo.id,
          clave: 'legal.habeas_data',
          // ConfiguracionGrupo.valor es String → se guarda el consentimiento
          // serializado (aceptado, fecha, ip, user_agent) para valor probatorio.
          valor: JSON.stringify({
            aceptado: input.acepta_habeas_data,
            fecha: new Date().toISOString(),
            ip: ctx.ip ?? null,
            user_agent: ctx.userAgent ?? null,
          }),
        },
      });

      return { usuarioCreado: usuario };
    });

    // Verificación de correo (estilo suave): la cuenta ya quedó activa y el usuario
    // entrará de una, pero se envía el enlace de verificación. Fuera de la
    // transacción y con fail-open: si el correo no sale (sin SMTP en dev, o falla),
    // el registro NO se cae — el usuario puede reenviar la verificación luego.
    const tokenVerif = await tokenAuthService.emitir(usuarioCreado.id, 'verificacion_email');
    await emailService.enviarEmail({
      to:      usuarioCreado.email,
      subject: 'Confirma tu correo',
      html:    plantillaVerificacion(usuarioCreado.nombre_completo, `${config.appUrl}/verificar-email?token=${tokenVerif}`),
      text:    `Verifica tu correo: ${config.appUrl}/verificar-email?token=${tokenVerif}`,
    });

    // Emitir sesión fuera de la transacción (recarga desde BD con la sede ya
    // vinculada, para que el JWT incluya restaurantes[] y grupos_admin).
    return authService.emitirSesion(usuarioCreado.usuario);
  },
};
