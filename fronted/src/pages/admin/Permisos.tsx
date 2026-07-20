/**
 * Permisos — Gestión de permisos RBAC en dos niveles:
 *
 *  1. "Por rol": permisos de los roles operativos (RolPermiso) — visible para
 *     superadmin y admins de grupo con permisos.gestionar (el backend impide
 *     a los no-SA tocar roles de sistema u otorgar permisos de administración).
 *  2. "Administradores" (solo superadmin): qué módulos del panel de
 *     administración puede usar cada dueño/admin de grupo, persona por persona
 *     (UsuarioPermiso). Es la jerarquía intermedia entre el SA y los operativos.
 */
import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, CircularProgress, Alert, Divider,
  Button, Chip, Snackbar, Tabs, Tab,
} from '@mui/material';
import { Save, AdminPanelSettings, CheckCircle, Cancel, SupervisorAccount } from '@mui/icons-material';
import { configuracionService, type Permiso } from '../../services/servicios-operacion';
import { permisoService, type AdminDeGrupo } from '../../services/permiso.service';
import { useAuthStore } from '../../store/useStore';
import api from '../../services/api';

interface Rol { id: number; nombre: string; es_super_admin: boolean; color?: string; }

const MODULO_COLORES: Record<string, string> = {
  inventario:     '#10b981',
  ventas:         '#6366f1',
  reportes:       '#0ea5e9',
  admin:          '#ef4444',
  administracion: '#f97316',
  produccion:     '#f59e0b',
};

/**
 * Códigos que habilitan módulos del panel /admin para un admin de grupo.
 * Espejo de ADMIN_GROUPS (Layout.tsx) y de los AdminGuard de App.tsx.
 */
const CODIGOS_PANEL_ADMIN = new Set([
  'usuarios.gestionar', 'sedes.gestionar', 'permisos.gestionar',
  'funciones.gestionar', 'config.sistema', 'categorias.gestionar',
  'apariencia.gestionar', 'plantillas.gestionar', 'auditoria.ver',
]);

const ROL_GRUPO_LABEL: Record<string, string> = { owner: 'Dueño', admin: 'Admin del grupo' };

export function Permisos() {
  const { isSuperAdmin } = useAuthStore();
  const [tab, setTab]             = useState<'roles' | 'admins'>('roles');
  const [roles, setRoles]         = useState<Rol[]>([]);
  const [permisos, setPermisos]   = useState<Permiso[]>([]);
  const [rolSel, setRolSel]       = useState<Rol | null>(null);
  const [seleccionados, setSelec] = useState<Set<number>>(new Set());
  const [loading, setLoading]     = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast]         = useState('');

  // ── Pestaña Administradores (solo superadmin) ─────────────────────────────
  const [admins, setAdmins]           = useState<AdminDeGrupo[]>([]);
  const [adminSel, setAdminSel]       = useState<AdminDeGrupo | null>(null);
  const [selecAdmin, setSelecAdmin]   = useState<Set<number>>(new Set());
  const [guardandoAdmin, setGuardandoAdmin] = useState(false);

  useEffect(() => {
    const cargas: Promise<unknown>[] = [
      configuracionService.getPermisos().catch(() => [] as Permiso[]),
      api.get('/usuarios/roles').catch(() => ({ data: { roles: [] } })),
    ];
    if (isSuperAdmin()) cargas.push(permisoService.getAdminsGrupo().catch(() => [] as AdminDeGrupo[]));

    Promise.all(cargas).then(([perms, rolesRes, adminsRes]) => {
      setPermisos(perms as Permiso[]);
      setRoles((rolesRes as any).data?.roles || (rolesRes as any).data?.data || []);
      if (adminsRes) setAdmins(adminsRes as AdminDeGrupo[]);
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seleccionarRol = async (rol: Rol) => {
    setRolSel(rol);
    try {
      const rp = await configuracionService.getPermisosRol(rol.id);
      setSelec(new Set(rp.map((p: Permiso) => p.id)));
    } catch {
      setSelec(new Set());
    }
  };

  const togglePermiso = (id: number) => {
    if (rolSel?.es_super_admin) return;
    setSelec(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const guardar = async () => {
    if (!rolSel) return;
    setGuardando(true);
    try {
      await configuracionService.sincronizarPermisos(rolSel.id, Array.from(seleccionados));
      setToast('Permisos guardados correctamente');
    } catch (e: any) {
      setToast(`Error: ${e.response?.data?.error || e.message || 'Error al guardar'}`);
    } finally { setGuardando(false); }
  };

  // ── Handlers pestaña Administradores ──────────────────────────────────────

  const seleccionarAdmin = async (admin: AdminDeGrupo) => {
    setAdminSel(admin);
    try {
      const directos = await permisoService.getPermisosUsuario(admin.id);
      setSelecAdmin(new Set(directos.map(p => p.id)));
    } catch {
      setSelecAdmin(new Set());
    }
  };

  const togglePermisoAdmin = (id: number) => {
    setSelecAdmin(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const guardarAdmin = async () => {
    if (!adminSel) return;
    setGuardandoAdmin(true);
    try {
      await permisoService.sincronizarPermisosUsuario(adminSel.id, Array.from(selecAdmin));
      setToast('Permisos del administrador guardados. Se aplican al renovar su sesión.');
    } catch (e: any) {
      setToast(`Error: ${e.message || 'Error al guardar'}`);
    } finally { setGuardandoAdmin(false); }
  };

  const modulosAgrupados = permisos.reduce<Record<string, Permiso[]>>((acc, p) => {
    if (!acc[p.modulo]) acc[p.modulo] = [];
    acc[p.modulo].push(p);
    return acc;
  }, {});

  // Permisos que habilitan módulos del panel de administración (para la pestaña Administradores)
  const permisosPanelAdmin = permisos.filter(p => CODIGOS_PANEL_ADMIN.has(p.codigo));

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, background: 'linear-gradient(135deg, #ef4444, #dc2626)', display: 'flex' }}>
          <AdminPanelSettings sx={{ color: 'white', fontSize: 24 }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={800}>Permisos</Typography>
          <Typography variant="body2" color="text.secondary">
            Permisos por rol y módulos habilitados para los administradores de grupo
          </Typography>
        </Box>
      </Box>

      {isSuperAdmin() && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab value="roles"  label="Por rol" />
          <Tab value="admins" label="Administradores" icon={<SupervisorAccount fontSize="small" />} iconPosition="start" />
        </Tabs>
      )}

      {tab === 'roles' && (
      <Grid container spacing={3}>
        {/* Lista de roles */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700}>Roles del sistema</Typography>
            </Box>
            {loading ? (
              <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box>
            ) : roles.map(rol => (
              <Box
                key={rol.id} onClick={() => seleccionarRol(rol)}
                sx={{
                  p: 2, cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider',
                  bgcolor: rolSel?.id === rol.id ? 'primary.50' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: rol.color || '#9ca3af' }} />
                  <Typography variant="body2" fontWeight={600}>{rol.nombre}</Typography>
                </Box>
                {rol.es_super_admin && (
                  <Chip label="Super" size="small" color="error" sx={{ height: 18, fontSize: '0.65rem' }} />
                )}
              </Box>
            ))}
          </Paper>
        </Grid>

        {/* Permisos del rol seleccionado */}
        <Grid size={{ xs: 12, md: 8 }}>
          {!rolSel ? (
            <Paper variant="outlined" sx={{ borderRadius: 2, p: 5, textAlign: 'center' }}>
              <AdminPanelSettings sx={{ fontSize: 52, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">Selecciona un rol para gestionar sus permisos</Typography>
            </Paper>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{
                p: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Permisos de <strong>{rolSel.nombre}</strong>
                </Typography>
                {!rolSel.es_super_admin && (
                  <Button size="small" variant="contained" startIcon={<Save />} onClick={guardar} disabled={guardando}>
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </Button>
                )}
              </Box>
              <Box sx={{ p: 2, maxHeight: 480, overflowY: 'auto' }}>
                {rolSel.es_super_admin && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    El superadmin tiene todos los permisos por defecto y no se pueden modificar.
                  </Alert>
                )}
                {Object.entries(modulosAgrupados).map(([modulo, perms]) => {
                  const color = MODULO_COLORES[modulo] || '#6b7280';
                  return (
                    <Box key={modulo} sx={{ mb: 3 }}>
                      <Typography variant="caption" fontWeight={800}
                        sx={{ color, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {modulo}
                      </Typography>
                      <Divider sx={{ mt: 0.5, mb: 1 }} />
                      <Grid container spacing={1}>
                        {perms.map(p => {
                          const activo = rolSel.es_super_admin || seleccionados.has(p.id);
                          return (
                            <Grid size={{ xs: 12, sm: 6 }} key={p.id}>
                              <Box
                                onClick={() => togglePermiso(p.id)}
                                sx={{
                                  p: 1.5, borderRadius: 1.5, border: '1px solid',
                                  borderColor: activo ? color : 'divider',
                                  bgcolor:     activo ? color + '12' : 'transparent',
                                  cursor:      rolSel.es_super_admin ? 'default' : 'pointer',
                                  display: 'flex', alignItems: 'center', gap: 1,
                                  transition: 'all 0.15s',
                                  '&:hover': !rolSel.es_super_admin ? { borderColor: color } : {},
                                }}
                              >
                                {activo
                                  ? <CheckCircle sx={{ fontSize: 16, color, flexShrink: 0 }} />
                                  : <Cancel sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
                                }
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="caption" fontWeight={600} display="block" noWrap>
                                    {p.nombre}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary"
                                    fontFamily="monospace" sx={{ fontSize: '0.62rem' }}>
                                    {p.codigo}
                                  </Typography>
                                </Box>
                              </Box>
                            </Grid>
                          );
                        })}
                      </Grid>
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>
      )}

      {/* ── Pestaña Administradores — permisos individuales por dueño de grupo ── */}
      {tab === 'admins' && isSuperAdmin() && (
      <Grid container spacing={3}>
        {/* Lista de administradores de grupo */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700}>Administradores de grupo</Typography>
              <Typography variant="caption" color="text.secondary">
                Dueños y admins de grupos de negocio
              </Typography>
            </Box>
            {loading ? (
              <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box>
            ) : admins.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No hay dueños/admins de grupo. Asigna el rol owner o admin a un usuario
                  desde el módulo Grupos.
                </Typography>
              </Box>
            ) : admins.map(admin => (
              <Box
                key={admin.id} onClick={() => seleccionarAdmin(admin)}
                sx={{
                  p: 2, cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider',
                  bgcolor: adminSel?.id === admin.id ? 'primary.50' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Typography variant="body2" fontWeight={600}>{admin.nombre_completo}</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                  {admin.grupos.map(g => (
                    <Chip
                      key={g.id_grupo} size="small"
                      label={`${g.grupo.nombre} · ${ROL_GRUPO_LABEL[g.rol_en_grupo] ?? g.rol_en_grupo}`}
                      sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#f9731622', color: '#c2540a' }}
                    />
                  ))}
                </Box>
              </Box>
            ))}
          </Paper>
        </Grid>

        {/* Módulos de administración habilitados para el admin seleccionado */}
        <Grid size={{ xs: 12, md: 8 }}>
          {!adminSel ? (
            <Paper variant="outlined" sx={{ borderRadius: 2, p: 5, textAlign: 'center' }}>
              <SupervisorAccount sx={{ fontSize: 52, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">
                Selecciona un administrador para decidir qué módulos del panel puede usar
              </Typography>
            </Paper>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{
                p: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Módulos de administración de <strong>{adminSel.nombre_completo}</strong>
                </Typography>
                <Button size="small" variant="contained" startIcon={<Save />} onClick={guardarAdmin} disabled={guardandoAdmin}>
                  {guardandoAdmin ? 'Guardando...' : 'Guardar'}
                </Button>
              </Box>
              <Box sx={{ p: 2 }}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Estos permisos habilitan módulos del panel de administración para este
                  dueño/admin, siempre limitados a los datos de su propio grupo.
                  Se aplican cuando renueve su sesión.
                </Alert>
                <Grid container spacing={1}>
                  {permisosPanelAdmin.map(p => {
                    const activo = selecAdmin.has(p.id);
                    const color  = MODULO_COLORES[p.modulo] || '#6b7280';
                    return (
                      <Grid size={{ xs: 12, sm: 6 }} key={p.id}>
                        <Box
                          onClick={() => togglePermisoAdmin(p.id)}
                          sx={{
                            p: 1.5, borderRadius: 1.5, border: '1px solid',
                            borderColor: activo ? color : 'divider',
                            bgcolor:     activo ? color + '12' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 1,
                            transition: 'all 0.15s',
                            '&:hover': { borderColor: color },
                          }}
                        >
                          {activo
                            ? <CheckCircle sx={{ fontSize: 16, color, flexShrink: 0 }} />
                            : <Cancel sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
                          }
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="caption" fontWeight={600} display="block" noWrap>
                              {p.nombre}
                            </Typography>
                            <Typography variant="caption" color="text.secondary"
                              fontFamily="monospace" sx={{ fontSize: '0.62rem' }}>
                              {p.codigo}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>
      )}

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={toast.startsWith('Error') ? 'error' : 'success'}
          onClose={() => setToast('')} variant="filled">
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Permisos;
