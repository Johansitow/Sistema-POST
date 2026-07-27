/**
 * OnboardingPrueba — "Probar configuración" (solo superadmin).
 *
 * Arriba: el wizard en modo prueba (elegir arquetipo → ajustar → Crear y entrar).
 * Abajo: panel de pruebas activas (tenants desechables) con Entrar y Eliminar.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, IconButton, Tooltip, Typography,
} from '@mui/material';
import { PlayArrow, DeleteOutline, Science, Store, AccountTree } from '@mui/icons-material';
import { WizardOnboarding } from '../../components/onboarding/WizardOnboarding';
import { onboardingService } from '../../services/onboarding.service';
import { useEntrarSandbox } from '../../lib/onboarding/entrarSandbox';
import { ARQUETIPOS_UI } from '../../lib/onboarding/catalogo';
import { ConfirmDialog, EmptyState, LoadingScreen } from '../../components/common';
import type { SandboxResumen } from '../../types/onboarding.types';

function etiquetaArquetipo(slug: string | null): string {
  if (!slug) return 'Personalizada';
  return ARQUETIPOS_UI.find(a => a.slug === slug)?.label ?? slug;
}

export function OnboardingPrueba() {
  const entrarSandbox = useEntrarSandbox();

  const [sandboxes, setSandboxes] = useState<SandboxResumen[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [entrando, setEntrando]   = useState<number | null>(null);
  const [aEliminar, setAEliminar] = useState<SandboxResumen | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSandboxes(await onboardingService.sandbox.listar());
    } catch {
      setError('No se pudieron cargar las pruebas activas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleEntrar = async (s: SandboxResumen) => {
    setEntrando(s.id_grupo);
    setError('');
    try {
      const creado = await onboardingService.sandbox.entrar(s.id_grupo);
      await entrarSandbox(creado); // navega al POS
    } catch {
      setError('No se pudo entrar a la prueba.');
      setEntrando(null);
    }
  };

  return (
    <Box sx={{ pb: 6 }}>
      <WizardOnboarding modo="prueba" />

      {/* ── Panel de pruebas activas ─────────────────────────────────────────── */}
      <Box sx={{ maxWidth: 680, mx: 'auto', mt: 4, px: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Science color="primary" fontSize="small" />
          <Typography variant="h6" fontWeight={600}>Pruebas activas</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Cada prueba es un entorno desechable con su propia configuración. Entra para usar el POS
          con esos ajustes y elimínala cuando termines — no afecta tus datos reales.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {loading ? (
          <LoadingScreen variant="inline" message="Cargando pruebas…" />
        ) : sandboxes.length === 0 ? (
          <EmptyState
            message="No hay pruebas activas. Crea una desde el wizard de arriba."
            icon={<Science sx={{ fontSize: 44, color: 'text.disabled' }} />}
          />
        ) : (
          sandboxes.map(s => (
            <Card key={s.id_grupo} variant="outlined" sx={{ mb: 1.5 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle2" fontWeight={700} noWrap>
                        {etiquetaArquetipo(s.arquetipo)}
                      </Typography>
                      <Chip
                        size="small"
                        icon={s.multisede ? <AccountTree sx={{ fontSize: 14 }} /> : <Store sx={{ fontSize: 14 }} />}
                        label={s.multisede
                          ? `Grupo · ${s.sedes.length} sedes`
                          : '1 restaurante'}
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Creada {new Date(s.fecha_creacion).toLocaleString()}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={entrando === s.id_grupo
                        ? <CircularProgress size={14} color="inherit" />
                        : <PlayArrow />}
                      onClick={() => handleEntrar(s)}
                      disabled={entrando !== null}
                    >
                      Entrar
                    </Button>
                    <Tooltip title="Eliminar prueba">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setAEliminar(s)}
                          disabled={entrando !== null}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))
        )}
      </Box>

      <ConfirmDialog
        open={!!aEliminar}
        title="Eliminar prueba"
        message={aEliminar
          ? `Se eliminará por completo "${etiquetaArquetipo(aEliminar.arquetipo)}" y todos sus datos de prueba. Esta acción no se puede deshacer.`
          : ''}
        confirmText="Eliminar"
        confirmColor="error"
        onConfirm={async () => {
          if (!aEliminar) return;
          await onboardingService.sandbox.eliminar(aEliminar.id_grupo);
          await cargar();
        }}
        onClose={() => setAEliminar(null)}
      />

      <Divider sx={{ mt: 4, opacity: 0 }} />
    </Box>
  );
}
