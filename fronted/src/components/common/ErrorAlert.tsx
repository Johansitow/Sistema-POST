/**
 * ErrorAlert — mensaje de error inline reutilizable para modales Tailwind
 *
 * Uso:
 * {error && <ErrorAlert message={error} />}
 */

import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  /** Clases adicionales para posicionamiento (ej. márgenes del contenedor padre) */
  className?: string;
}

export function ErrorAlert({ message, className = '' }: ErrorAlertProps) {
  return (
    <div className={`bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm ${className}`}>
      <AlertCircle className="w-4 h-4 flex-shrink-0" />{message}
    </div>
  );
}
