-- CreateTable
CREATE TABLE "usuario_permisos" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_permiso" INTEGER NOT NULL,
    "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usuario_permisos_id_usuario_idx" ON "usuario_permisos"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_permisos_id_usuario_id_permiso_key" ON "usuario_permisos"("id_usuario", "id_permiso");

-- AddForeignKey
ALTER TABLE "usuario_permisos" ADD CONSTRAINT "usuario_permisos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_permisos" ADD CONSTRAINT "usuario_permisos_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Permisos del panel de administración para admins de grupo (dueños).
-- No se asignan a ningún rol: el superadmin los otorga por persona vía UsuarioPermiso.
INSERT INTO "permisos" ("nombre", "codigo", "modulo", "descripcion") VALUES
  ('Gestionar sedes',      'sedes.gestionar',      'administracion', 'Editar sedes del grupo, activar/desactivar, vincular usuarios y crear sedes hasta el límite del plan'),
  ('Gestionar categorías', 'categorias.gestionar', 'administracion', 'Administrar las categorías del catálogo del grupo'),
  ('Gestionar funciones',  'funciones.gestionar',  'administracion', 'Ver feature flags y gestionar sus asignaciones dentro del grupo'),
  ('Gestionar apariencia', 'apariencia.gestionar', 'administracion', 'Personalizar la apariencia (UI config) del grupo y sus sedes'),
  ('Gestionar plantillas', 'plantillas.gestionar', 'administracion', 'Administrar las plantillas de impresión del grupo'),
  ('Gestionar permisos',   'permisos.gestionar',   'administracion', 'Ajustar permisos de los roles operativos (no de sistema)')
ON CONFLICT ("codigo") DO NOTHING;
