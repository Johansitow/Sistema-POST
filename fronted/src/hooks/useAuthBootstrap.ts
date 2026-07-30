/**
 * useAuthBootstrap — valida la sesión contra el backend al arrancar la app.
 *
 * Problema que resuelve: el authStore persiste `isAuthenticated` en localStorage y,
 * al recargar, se rehidrata como `true` sin comprobar que el token siga siendo
 * válido. Eso hacía que la UI logueada apareciera un instante antes de que el primer
 * request fallara. Aquí, ANTES de montar las rutas, verificamos el token:
 *
 *   - Hay token → GET /auth/profile. El interceptor de axios ya renueva en 401 y, si
 *     el refresh falla, limpia la sesión y redirige a /login.
 *       · Éxito → la sesión es válida, se mantiene tal cual.
 *       · 401/403 → token inválido: cerramos sesión.
 *       · Red / 5xx → NO cerramos sesión (el token podría seguir siendo válido; es un
 *         problema transitorio del servidor). Solo dejamos pasar.
 *   - No hay token → nada que validar.
 *
 * No sobrescribimos `user` con el perfil: el perfil no trae los claims de acceso
 * (`permisos`, `grupos_admin`, `es_super_admin`) que sí guarda el login. Aquí solo
 * se valida la vigencia del token.
 *
 * Devuelve `ready`: mientras es `false`, App muestra una pantalla de carga.
 */

import { useEffect, useState } from 'react';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/useStore';

export function useAuthBootstrap(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelado = false;

    const token = useAuthStore.getState().accessToken;
    if (!token) {
      setReady(true);
      return;
    }

    authService.getProfile()
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          useAuthStore.getState().logout();
        }
        // Otros errores (red / 5xx): dejamos la sesión intacta.
      })
      .finally(() => {
        if (!cancelado) setReady(true);
      });

    return () => { cancelado = true; };
  }, []);

  return ready;
}
