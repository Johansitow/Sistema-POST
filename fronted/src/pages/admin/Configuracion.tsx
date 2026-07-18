/**
 * Configuración del Sistema — Parámetros del sistema (key/value editable)
 */
import { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Paper, Chip, Tooltip, CircularProgress, Alert, Snackbar,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  IconButton, TextField, Select, MenuItem, Link,
} from '@mui/material';
import { Settings, Edit, Save, Close, Lock } from '@mui/icons-material';
import { configuracionService, type Configuracion as ConfiguracionType } from '../../services/servicios-operacion';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIA_COLORES: Record<string, string> = {
  general:     '#6366f1',
  facturacion: '#0ea5e9',
  ventas:      '#10b981',
  inventario:  '#f59e0b',
  caja:        '#8b5cf6',
  produccion:  '#ef4444',
};

// ─────────────────────────────────────────────────────────────────────────────
// Parámetros del sistema
// ─────────────────────────────────────────────────────────────────────────────

function ParamsTab() {
  const [configs, setConfigs]     = useState<ConfiguracionType[]>([]);
  const [editando, setEditando]   = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<Record<string, boolean>>({});
  const [loading, setLoading]     = useState(true);
  const [catActiva, setCat]       = useState('all');
  const [toast, setToast]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setConfigs(await configuracionService.getAll()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categorias = ['all', ...Array.from(new Set(configs.map(c => c.categoria)))];
  const filtradas  = catActiva === 'all' ? configs : configs.filter(c => c.categoria === catActiva);

  const handleSave = async (clave: string) => {
    setGuardando(p => ({ ...p, [clave]: true }));
    try {
      await configuracionService.update(clave, editando[clave]);
      setEditando(p => { const n = { ...p }; delete n[clave]; return n; });
      setToast('Parámetro guardado correctamente');
      await load().catch(() => {});
    } catch (e: any) {
      setToast(`Error: ${e.response?.data?.error || e.message || 'Error al guardar'}`);
    } finally { setGuardando(p => ({ ...p, [clave]: false })); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {categorias.map(cat => {
          const color = cat === 'all' ? '#374151' : (CATEGORIA_COLORES[cat] || '#9ca3af');
          return (
            <Chip
              key={cat}
              label={cat === 'all' ? 'Todas' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              onClick={() => setCat(cat)}
              variant={catActiva === cat ? 'filled' : 'outlined'}
              sx={{
                borderColor: color,
                bgcolor:     catActiva === cat ? color : 'transparent',
                color:       catActiva === cat ? 'white' : color,
                fontWeight:  catActiva === cat ? 700 : 400,
                cursor: 'pointer',
              }}
            />
          );
        })}
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 700 }}>Clave</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Descripción</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Categoría</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Valor actual</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 110 }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtradas.map(cfg => {
              const enEdicion = editando[cfg.clave] !== undefined;
              const color     = CATEGORIA_COLORES[cfg.categoria] || '#9ca3af';
              return (
                <TableRow key={cfg.clave} hover>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" fontWeight={700} sx={{ color: '#6366f1' }}>
                      {cfg.clave}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{cfg.descripcion || '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={cfg.categoria} size="small"
                      sx={{ bgcolor: color + '20', color, fontWeight: 600, fontSize: '0.7rem' }} />
                  </TableCell>
                  <TableCell>
                    {enEdicion ? (
                      cfg.tipo_dato === 'boolean' ? (
                        <Select size="small" value={editando[cfg.clave]}
                          onChange={e => setEditando(p => ({ ...p, [cfg.clave]: e.target.value }))}>
                          <MenuItem value="true">Activado</MenuItem>
                          <MenuItem value="false">Desactivado</MenuItem>
                        </Select>
                      ) : (
                        <TextField
                          size="small"
                          value={editando[cfg.clave]}
                          onChange={e => setEditando(p => ({ ...p, [cfg.clave]: e.target.value }))}
                          type={cfg.tipo_dato === 'number' ? 'number' : 'text'}
                          sx={{ minWidth: 160 }}
                        />
                      )
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {cfg.tipo_dato === 'boolean' ? (
                          <Chip label={cfg.valor === 'true' ? 'Activado' : 'Desactivado'}
                            size="small" color={cfg.valor === 'true' ? 'success' : 'default'} />
                        ) : (
                          <Typography variant="body2" fontWeight={600}>{cfg.valor}</Typography>
                        )}
                        {!cfg.es_editable && (
                          <Tooltip title="Solo lectura">
                            <Lock sx={{ fontSize: 13, color: 'text.disabled' }} />
                          </Tooltip>
                        )}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    {cfg.es_editable && (
                      enEdicion ? (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Guardar">
                            <span>
                              <IconButton size="small" color="success"
                                onClick={() => handleSave(cfg.clave)} disabled={guardando[cfg.clave]}>
                                {guardando[cfg.clave] ? <CircularProgress size={14} /> : <Save fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Cancelar">
                            <IconButton size="small" color="error"
                              onClick={() => setEditando(p => { const n = { ...p }; delete n[cfg.clave]; return n; })}>
                              <Close fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ) : (
                        <Tooltip title="Editar">
                          <IconButton size="small"
                            onClick={() => setEditando(p => ({ ...p, [cfg.clave]: cfg.valor }))}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

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

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function Configuracion() {
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex' }}>
          <Settings sx={{ color: 'white', fontSize: 24 }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={800}>Parámetros del sistema</Typography>
          <Typography variant="body2" color="text.secondary">
            Configuración de parámetros y valores del sistema
          </Typography>
        </Box>
      </Box>

      <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
        Estos valores son datos internos del negocio (razón social, NIT, teléfono, etc.), no la marca visible de la app.
        Para cambiar el nombre, color o logo que se muestran en el sistema, usa{' '}
        <Link component={RouterLink} to="/admin/apariencia" fontWeight={700}>Personalización → Apariencia</Link>.
      </Alert>

      <Paper variant="outlined" sx={{ borderRadius: 2, p: 3 }}>
        <ParamsTab />
      </Paper>
    </Box>
  );
}

export default Configuracion;
