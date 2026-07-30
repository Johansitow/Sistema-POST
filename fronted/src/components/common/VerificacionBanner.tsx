/**
 * VerificacionBanner — aviso persistente para que el usuario verifique su correo.
 *
 * Verificación SUAVE: no bloquea el uso general, solo recuerda y permite reenviar
 * el enlace. Se muestra únicamente cuando el usuario tiene `email_verificado === false`
 * explícito (un token viejo sin el campo NO dispara el banner). El superadmin no lo ve.
 */

import { useState } from 'react';
import { Alert, Button } from '@mui/material';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/useStore';

export function VerificacionBanner() {
  const { user } = useAuthStore();
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Solo cuando está explícitamente sin verificar y no es superadmin.
  if (!user || user.es_super_admin || user.email_verificado !== false) return null;

  const reenviar = async () => {
    setEnviando(true);
    try {
      const r = await authService.reenviarVerificacion();
      setMensaje(r.message);
    } catch {
      setMensaje('No pudimos reenviar el correo. Intenta más tarde.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Alert
      severity="warning"
      sx={{ borderRadius: 0 }}
      action={mensaje ? undefined : (
        <Button color="inherit" size="small" onClick={reenviar} disabled={enviando} sx={{ fontWeight: 700 }}>
          Reenviar correo
        </Button>
      )}
    >
      {mensaje ?? 'Verifica tu correo para asegurar tu cuenta. Te enviamos un enlace al registrarte.'}
    </Alert>
  );
}
