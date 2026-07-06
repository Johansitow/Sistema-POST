/**
 * components/common/index.ts
 *
 * Barrel export — permite importar todos los componentes comunes desde una sola ruta:
 *
 * ✅ Con barrel:
 * import { ConfirmDialog, PageHeader, StatusChip } from '../components/common';
 *
 * ❌ Sin barrel (verboso):
 * import { ConfirmDialog } from '../components/common/ConfirmDialog';
 * import { PageHeader }    from '../components/common/PageHeader';
 * import { StatusChip }    from '../components/common/StatusChip';
 */

export { ConfirmDialog  } from './ConfirmDialog';
export { EmptyState     } from './EmptyState';
export { ErrorBoundary  } from './ErrorBoundary';
export { GlobalSnackbar } from './GlobalSnackbar';
export { LoadingScreen  } from './LoadingScreen';
export { PageHeader     } from './PageHeader';
export { StatusChip     } from './StatusChip';
export { TableSkeleton, CardSkeleton, FormSkeleton, ListSkeleton } from './Skeletons';
export { RequireRestaurante } from './RequireRestaurante';
export { default as ModalHeader } from './ModalHeader';
export { EstadoListaBadge, ESTADO_LISTA_CFG } from './EstadoListaBadge';
