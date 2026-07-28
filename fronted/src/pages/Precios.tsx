/**
 * Precios — página PÚBLICA (sin sesión) con la escalera de planes.
 *
 * Es el imán del embudo masivo: cualquiera la ve, compara los planes y entra a
 * /registro. Los planes salen de GET /planes (catálogo del backend); la marca
 * (nombre/logo/color) de brandingStore, que carga sin sesión.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Chip, Container, Divider,
  List, ListItem, ListItemIcon, ListItemText, Typography, CircularProgress,
} from '@mui/material';
import { CheckCircle, RestaurantMenu } from '@mui/icons-material';
import { useBrandingStore } from '../store/brandingStore';
import { planesService, formatoCOP, type Plan } from '../services/planes.service';

export function Precios() {
  const navigate = useNavigate();
  const { nombreSistema, logoUrl } = useBrandingStore();
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    planesService.listar()
      .then(setPlanes)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: { xs: 4, md: 8 } }}>
      <Container maxWidth="lg">

        {/* ── Encabezado ── */}
        <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            {logoUrl
              ? <Box component="img" src={logoUrl} alt={nombreSistema} sx={{ height: 56 }} />
              : <RestaurantMenu color="primary" sx={{ fontSize: 48 }} />}
          </Box>
          <Typography variant="h3" fontWeight={800} gutterBottom>
            Planes de {nombreSistema}
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 620, mx: 'auto' }}>
            Empieza gratis y crece cuando lo necesites. Sin contratos, cancelas cuando quieras.
          </Typography>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        )}
        {error && !loading && (
          <Typography align="center" color="text.secondary">
            No pudimos cargar los planes. Intenta de nuevo en un momento.
          </Typography>
        )}

        {/* ── Tarjetas de planes ── */}
        {!loading && !error && (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 3, alignItems: 'stretch',
          }}>
            {planes.map(plan => (
              <Card
                key={plan.codigo}
                elevation={plan.destacado ? 8 : 1}
                sx={{
                  display: 'flex', flexDirection: 'column', position: 'relative',
                  border: theme => plan.destacado ? `2px solid ${theme.palette.primary.main}` : '1px solid',
                  borderColor: plan.destacado ? 'primary.main' : 'divider',
                }}
              >
                {plan.destacado && (
                  <Chip
                    label="Más popular" color="primary" size="small"
                    sx={{ position: 'absolute', top: 16, right: 16, fontWeight: 700 }}
                  />
                )}
                <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                  <Typography variant="overline" color="text.secondary">{plan.nombre}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, my: 1 }}>
                    <Typography variant="h3" fontWeight={800}>
                      {plan.precio_mensual_cop === 0 ? 'Gratis' : formatoCOP(plan.precio_mensual_cop)}
                    </Typography>
                    {plan.precio_mensual_cop > 0 && (
                      <Typography variant="body2" color="text.secondary">/mes</Typography>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
                    {plan.descripcion}
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <List dense sx={{ flexGrow: 1 }}>
                    {plan.modulos.map((m, i) => (
                      <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckCircle color="primary" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={m} />
                      </ListItem>
                    ))}
                  </List>

                  <Button
                    fullWidth size="large"
                    variant={plan.destacado ? 'contained' : 'outlined'}
                    onClick={() => navigate('/registro')}
                    sx={{ mt: 2, fontWeight: 700 }}
                  >
                    {plan.precio_mensual_cop === 0 ? 'Empezar gratis' : 'Empezar prueba'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {/* ── Pie ── */}
        <Box sx={{ textAlign: 'center', mt: 5 }}>
          <Typography variant="body2" color="text.secondary">
            ¿Ya tienes cuenta?{' '}
            <Button variant="text" size="small" onClick={() => navigate('/login')}>
              Inicia sesión
            </Button>
          </Typography>
        </Box>

      </Container>
    </Box>
  );
}
