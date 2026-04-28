export * from './api';
export * from './dashboard.service';
export * from './inventario.service';
export * from './reportes.service';
export * from './permiso.service';

// productos.service y ordenes.service exportan PaginatedResult con el mismo nombre
// — se exportan por separado para evitar la ambigüedad
export type { PaginatedResult, Categoria, Producto, ProductosParams, ProductoCreateDTO, ProductoUpdateDTO, UpdateStockDTO } from './productos.service';
export type { Orden, OrdenDetalle, EstadoOrden, OrdenesParams, DetalleInput, OrdenCreateDTO, OrdenUpdateDTO } from './ordenes.service';

// categorias.service se exporta individualmente para evitar conflicto con Categoria de productos.service
export { categoriasService } from './categorias.service';

// Instancias nombradas
export { default as api    } from './api';
export { productosService  } from './productos.service';
export { ordenesService    } from './ordenes.service';
export { dashboardService  } from './dashboard.service';
export { inventarioService } from './inventario.service';
export { reportesService   } from './reportes.service';
export { permisoService    } from './permiso.service';