import { X } from 'lucide-react';

interface ModalHeaderProps {
  title:     string;
  subtitle?: string;
  onClose:   () => void;
  /** Tailwind gradient classes, e.g. "from-teal-600 to-emerald-600". Defaults to primary. */
  gradient?: string;
}

/**
 * ModalHeader — reusable gradient header for modals.
 * Replaces the repeated pattern of bg-gradient-to-r + title + X button.
 */
export default function ModalHeader({
  title,
  subtitle,
  onClose,
  gradient = 'from-emerald-600 to-teal-600',
}: ModalHeaderProps) {
  return (
    <div className={`bg-gradient-to-r ${gradient} px-6 py-4 flex items-center justify-between`}>
      <div>
        {subtitle && <p className="text-white/70 text-xs mb-0.5">{subtitle}</p>}
        <h2 className="text-white font-bold">{title}</h2>
      </div>
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/20 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
