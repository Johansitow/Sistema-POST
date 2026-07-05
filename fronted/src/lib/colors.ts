/**
 * Color palette — centralized Tailwind class definitions.
 * Import COLORS instead of writing gradient/status class strings inline.
 *
 * Usage:
 *   import { COLORS } from '@/lib/colors';
 *   <div className={`bg-gradient-to-r ${COLORS.PRIMARY.gradient} text-white`}>
 */
export const COLORS = {
  // Primary action gradient (botones guardar, headers principales)
  PRIMARY: {
    gradient: 'from-emerald-600 to-teal-600',
    dark:     'from-emerald-700 to-teal-700',
    light:    'from-emerald-50  to-teal-50',
    text:     'text-emerald-600',
  },

  // Secondary gradient (acciones alternativas, info)
  SECONDARY: {
    gradient: 'from-blue-600 to-indigo-600',
    dark:     'from-blue-700 to-indigo-700',
    light:    'from-blue-50  to-indigo-50',
    text:     'text-blue-600',
  },

  // Danger / destructive
  DANGER: {
    gradient: 'from-red-600 to-rose-600',
    dark:     'from-red-700 to-rose-700',
    text:     'text-red-600',
  },

  // Warning (alertas, merma, stock bajo)
  WARNING: {
    gradient: 'from-amber-500 to-orange-500',
    dark:     'from-amber-600 to-orange-600',
    text:     'text-amber-600',
  },

  // Order / inventory status colors (badges, pills)
  STATUS: {
    pending:    { bg: 'bg-yellow-100',  text: 'text-yellow-700',  border: 'border-yellow-300' },
    inProgress: { bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-300' },
    ready:      { bg: 'bg-green-100',   text: 'text-green-700',   border: 'border-green-300'  },
    completed:  { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300'   },
    cancelled:  { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300'    },
    info:       { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200'  },
  },

  // Neutral (backgrounds, borders, text — preferir estos en lugar de hardcodear slate-*)
  NEUTRAL: {
    bgPage:      'bg-slate-50',
    bgCard:      'bg-white',
    bgRow:       'bg-slate-50',
    border:      'border-slate-200',
    borderLight: 'border-slate-100',
    text:        'text-slate-900',
    textMuted:   'text-slate-500',
    textDisabled:'text-slate-400',
    divider:     'divide-slate-100',
  },
} as const;
