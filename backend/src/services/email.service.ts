/**
 * emailService — envío de correos transaccionales (verificación, reset de clave).
 *
 * Filosofía FAIL-OPEN (igual que Redis en `config/redis.ts`): el correo es un
 * accesorio, no una dependencia dura. Si no hay SMTP configurado (típico en
 * desarrollo) o el envío falla, NO se lanza excepción: se registra en el log
 * (incluido el enlace, para poder probar en local) y el flujo principal —el
 * registro o la solicitud de reset— sigue su curso.
 *
 * Provider-agnóstico: usa nodemailer con SMTP configurable por env, así funciona
 * con Brevo, Resend, SendGrid, Gmail o cualquier servidor SMTP. Para producción
 * se configuran `SMTP_HOST/PORT/USER/PASS/FROM/SECURE`.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config/env';
import logger from '../config/logger';

export interface EmailMensaje {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Transporter lazy singleton. `undefined` = aún no inicializado; `null` = sin SMTP. */
let transporter: Transporter | null | undefined;

const getTransporter = (): Transporter | null => {
  if (transporter !== undefined) return transporter;

  const { host, port, user, pass, secure } = config.smtp;
  if (!host) {
    transporter = null; // sin SMTP configurado → modo consola
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure, // true = 465 (TLS directo); false = 587 (STARTTLS)
    auth: user ? { user, pass } : undefined,
  });
  return transporter;
};

/**
 * enviarEmail — intenta enviar; nunca rompe el flujo que lo llama.
 * Retorna `{ enviado }` para que el caller pueda loguear/telemetría si quiere,
 * pero no debe usarse para decidir el resultado de la operación de negocio.
 */
export const emailService = {
  async enviarEmail(msg: EmailMensaje): Promise<{ enviado: boolean }> {
    const tx = getTransporter();

    if (!tx) {
      // Sin SMTP: no es un error en dev. Se loguea para poder seguir el enlace.
      logger.warn(
        `📧 SMTP no configurado — correo NO enviado a ${msg.to}. ` +
        `Asunto: "${msg.subject}". Contenido (dev):\n${msg.text ?? msg.html}`
      );
      return { enviado: false };
    }

    try {
      await tx.sendMail({
        from: config.smtp.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
      return { enviado: true };
    } catch (err) {
      // Fail-open: el registro/solicitud no debe caerse porque el correo falle.
      logger.error(`📧 Falló el envío a ${msg.to}: ${(err as Error).message}`);
      return { enviado: false };
    }
  },
};

// ── Plantillas HTML simples (inline; sin dependencia de assets externos) ───────

const layout = (titulo: string, cuerpo: string): string => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a2e">
    <h2 style="color:#10B981;margin:0 0 16px">${titulo}</h2>
    ${cuerpo}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
    <p style="font-size:12px;color:#888">Si no solicitaste esto, puedes ignorar este correo.</p>
  </div>`;

const boton = (url: string, texto: string): string => `
  <p style="margin:24px 0">
    <a href="${url}" style="background:#10B981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;display:inline-block">${texto}</a>
  </p>
  <p style="font-size:13px;color:#666">O copia y pega este enlace:<br/><span style="color:#0f3460">${url}</span></p>`;

export const plantillaVerificacion = (nombre: string, url: string): EmailMensaje['html'] & string =>
  layout(
    'Confirma tu correo',
    `<p>Hola ${nombre}, gracias por crear tu cuenta.</p>
     <p>Confirma que este correo es tuyo para asegurar tu cuenta:</p>
     ${boton(url, 'Verificar mi correo')}
     <p style="font-size:13px;color:#666">El enlace vence en 24 horas.</p>`
  );

export const plantillaReset = (nombre: string, url: string): EmailMensaje['html'] & string =>
  layout(
    'Restablece tu contraseña',
    `<p>Hola ${nombre}, recibimos una solicitud para restablecer tu contraseña.</p>
     ${boton(url, 'Crear nueva contraseña')}
     <p style="font-size:13px;color:#666">El enlace vence en 1 hora. Si no fuiste tú, ignora este correo; tu contraseña no cambiará.</p>`
  );
