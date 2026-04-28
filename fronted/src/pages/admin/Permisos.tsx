/**
 * Permisos — Gestión de permisos por rol (RBAC)
 */
import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, CircularProgress, Alert, Divider,
  Button, Chip, Snackbar,
} from '@mui/material';
import { Save, AdminPanelSettings, CheckCircle, Cancel } from '@mui/icons-material';
import { configuracionService, type Permiso } from '../../services/servicios-operacion';
import api from '../../services/api';

interface Rol { id: number; nombre: string; es_super_admin: boolean; color?: string; }

const MODULO_COLORES: Record<string, string> = {
  inventario: '#10b981',
  ventas:     '#6366f1',
  reportes:   '#0ea5e9',
  admin:      '#ef4444',
  produccion: '#f59e0b',
};

export function Permisos() {
  const [roles, setRoles]         = useState<Rol[]>([]);
  const [permisos, setPermisos]   = useState<Permiso[]>([]);
  const [rolSel, setRolSel]       = useState<Rol | null>(null);
  const [seleccionados, setSelec] = useState<Set<number>>(new Set());
  const [loading, setLoading]     = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast]         = useState('');

  useEffect(() => {
    Promise.all([
      configuracionService.getPermisos().catch(() => [] as Permiso[]),
      api.get('/usuarios/roles').catch(() => ({ data: { roles: [] } })),
    ]).then(([perms, rolesRes]) => {
      setPermisos(perms);
      setRoles(rolesRes.data?.roles || rolesRes.data?.data || []);
    }).finally(() => setLoading(false));
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

  const modulosAgrupados = permisos.reduce<Record<string, Permiso[]>>((acc, p) => {
    if (!acc[p.modulo]) acc[p.modulo] = [];
    acc[p.modulo].push(p);
    return acc;
  }, {});

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, background: 'linear-gradient(135deg, #ef4444, #dc2626)', display: 'flex' }}>
          <AdminPanelSettings sx={{ color: 'white', fontSize: 24 }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={800}>Permisos por rol</Typography>
          <Typography variant="body2" color="text.secondary">
            Gestiona los permisos RBAC para cada rol del sistema
          </Typography>
        </Box>
      </Box>

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
