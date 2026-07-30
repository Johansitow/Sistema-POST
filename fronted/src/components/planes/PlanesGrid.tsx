/**
 * PlanesGrid — grid público de tarjetas de planes (fuente: GET /planes).
 *
 * Se extrajo de Precios.tsx para reutilizarlo tal cual en la landing pública y en
 * la página de precios sin duplicar el fetch ni el render de las tarjetas. Es
 * autocontenido: hace su propio fetch y maneja loading/error. Todos los CTA llevan
 * a /registro (el alta self-serve en plan Gratis).
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Chip, Divider,
  List, ListItem, ListItemIcon, ListItemText, Typography, CircularProgress,
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { planesService, formatoCOP, type Plan } from '../../services/planes.service';

export function PlanesGrid() {
  const navigate = useNavigate();
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    planesService.listar()
      .then(setPlanes)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
    );
  }

  if (error) {
    return (
      <Typography align="center" color="text.secondary">
        No pudimos cargar los planes. Intenta de nuevo en un momento.
      </Typography>
    );
  }

  return (
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
  );
}
