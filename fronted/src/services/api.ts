/**
 * Configuración de Axios - Cliente HTTP
 *
 * Manejo de autenticación:
 * - El token vive en Zustand (persist) bajo la clave 'auth-storage'
 * - Estructura en localStorage: { state: { accessToken, user, ... }, version: 0 }
 * - El interceptor de request lo lee desde ahí en cada petición
 *
 * Flujo de errores:
 * - 401: intenta renovar el accessToken con el refreshToken (una vez)
 *        Si el refresh falla → limpia auth-storage y redirige al login
 * - 403/404/409/422/429/5xx: loguea el error y lo propaga
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { toast } from '../store/uiStore';

// ─── Configuración base ───────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Control de refresh en vuelo ──────────────────────────────────────────────

// Evita múltiples llamadas a /auth/refresh si varias requests fallan con 401 a la vez.
// isRefreshing: true mientras hay una llamada a /refresh en curso.
// failedQueue: requests que llegaron mientras el refresh estaba en curso.

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject:  (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else       resolve(token!);
  });
  failedQueue = [];
};

// ─── Helpers para leer/escribir desde Zustand persist ────────────────────────

const getAccessToken = (): string | null => {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.accessToken ?? null;
  } catch {
    return null;
  }
};

const getRefreshToken = (): string | null => {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.refreshToken ?? null;
  } catch {
    return null;
  }
};

/**
 * Actualiza el accessToken en el store de Zustand (localStorage)
 * sin importar el store directamente (evita dependencia circular).
 */
const updateAccessTokenInStorage = (accessToken: string, refreshToken: string) => {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.state.accessToken  = accessToken;
    parsed.state.refreshToken = refreshToken;
    localStorage.setItem('auth-storage', JSON.stringify(parsed));
  } catch {
    // Si el JSON está corrupto, ignorar — el siguiente request forzará logout
  }
};

const clearSession = () => {
  localStorage.removeItem('auth-storage');
  delete api.defaults.headers.common['Authorization'];
};

// ─── Helpers para leer el restaurante activo desde su propio store ────────────

const getRestauranteId = (): number | undefined => {
  try {
    const raw = localStorage.getItem('restaurante-activo');
    if (!raw) return undefined;
    return JSON.parse(raw)?.state?.activo?.id ?? undefined;
  } catch {
    return undefined;
  }
};

// ─── Interceptor de Request ───────────────────────────────────────────────────

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Enviar el restaurante activo en cada request (el backend lo usa para scoping)
    const restauranteId = getRestauranteId();
    if (restauranteId && config.headers) {
      config.headers['X-Restaurante-Id'] = String(restauranteId);
    }

    if (import.meta.env.DEV) {
      console.log('🔵 API Request:', {
        method: config.method?.toUpperCase(),
        url:    config.url,
        data:   config.data,
        params: config.params,
      });
    }

    return config;
  },
  (error: AxiosError) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// ─── Interceptor de Response ──────────────────────────────────────────────────

api.interceptors.response.use(
  (response: AxiosResponse) => {
    if (import.meta.env.DEV) {
      console.log('🟢 API Response:', {
        status: response.status,
        url:    response.config.url,
        data:   response.data,
      });
    }
    return response;
  },

  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // ── 401: intentar renovar el token ────────────────────────────────────────
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = getRefreshToken();

      // Sin refresh token → logout directo
      if (!refreshToken) {
        clearSession();
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      // Si ya hay un refresh en curso, encolar esta request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      // Iniciar refresh
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken: newAccess, refreshToken: newRefresh } = data.tokens;

        updateAccessTokenInStorage(newAccess, newRefresh);
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;

        processQueue(null, newAccess);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearSession();
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ── Otros errores ─────────────────────────────────────────────────────────
    console.error('❌ API Error:', {
      message: error.message,
      status:  error.response?.status,
      url:     error.config?.url,
      data:    error.response?.data,
    });

    if (error.response) {
      const status = error.response.status;
      const data: any = error.response.data;

      switch (status) {
        case 403:
          // Las páginas muestran contexto propio para 403; solo log
          console.error('Acceso prohibido:', data?.error || data?.message);
          break;
        case 404:
          console.error('Recurso no encontrado:', data?.error || data?.message);
          break;
        case 409:
          console.error('Conflicto:', data?.error || data?.message);
          break;
        case 422:
          console.error('Error de validación:', data?.errors || data?.error || data?.message);
          break;
        case 429:
          toast.warning('Demasiadas peticiones. Por favor espera un momento.');
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          toast.error('Error del servidor. Por favor intenta más tarde.', 6000);
          break;
        default:
          console.error('Error desconocido:', data?.error || data?.message || 'Error en la petición');
      }
    } else if (error.request) {
      toast.error('Sin respuesta del servidor. Verifica tu conexión.');
    } else {
      console.error('Error al configurar la petición:', error.message);
    }

    return Promise.reject(error);
  }
);

// ─── Helpers exportados ───────────────────────────────────────────────────────

/**
 * setAuthToken — establece el token en los headers por defecto de axios.
 * Útil cuando el token se renueva manualmente y se necesita actualizar axios
 * sin esperar al próximo interceptor de request.
 */
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

/**
 * clearAuth — limpia la sesión completamente.
 * Elimina auth-storage (Zustand persist) y el header de axios.
 */
export const clearAuth = () => {
  clearSession();
};

/**
 * getErrorMessage — extrae el mensaje de error de una respuesta axios.
 */
export const getErrorMessage = (error: any): string => {
  if (error.response) {
    const data = error.response.data;
    return data?.error || data?.message || 'Error en el servidor';
  } else if (error.request) {
    return 'No se pudo conectar con el servidor. Verifique su conexión.';
  }
  return error.message || 'Error desconocido';
};

/**
 * isValidationError — verifica si el error es de validación (422)
 */
export const isValidationError = (error: any): boolean =>
  error.response?.status === 422;

/**
 * getValidationErrors — extrae los errores de validación del response
 */
export const getValidationErrors = (error: any): Record<string, string[]> | null => {
  if (isValidationError(error)) {
    return error.response?.data?.errors || null;
  }
  return null;
};

export default api;
