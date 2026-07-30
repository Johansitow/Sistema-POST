/**
 * utils/index.ts
 *
 * Barrel export — permite importar utilidades desde una sola ruta:
 *
 * ✅ Con barrel:
 * import { formatCurrency, formatDate, ESTADOS, validateEmail } from '../utils';
 *
 * ❌ Sin barrel (verboso):
 * import { formatCurrency } from '../utils/format';
 * import { ESTADOS }        from '../utils/constants';
 * import { validateEmail }  from '../utils/validators';
 */

export * from './constants';
export * from './export';
export * from './format';
export * from './validators';
