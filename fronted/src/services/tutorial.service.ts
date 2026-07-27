/**
 * tutorialService — cliente HTTP del progreso del modo tutorial (product tour).
 *
 * Reutiliza el singleton api (JWT + X-Restaurante-Id automáticos). El progreso es
 * PERSONAL: el backend saca el id del token, nunca de la URL. Por eso vive bajo
 * /auth/mi-tutorial, junto a /auth/mi-perfil, y no requiere permiso de admin.
 *
 * La ruta responde el objeto plano { tutorial_completado }, no el sobre
 * { success, data } de los recursos CRUD.
 */

import api from './api';

interface RespuestaTutorial {
  tutorial_completado: boolean;
}

async function marcar(completado: boolean): Promise<boolean> {
  const { data } = await api.patch<RespuestaTutorial>('/auth/mi-tutorial', { completado });
  return data.tutorial_completado;
}

export const tutorialService = {
  /** Al finalizar u omitir el tour. */
  marcarCompletado: () => marcar(true),
  /** Para volver a mostrar el tour (p. ej. desde soporte). */
  reiniciar: () => marcar(false),
};
