/**
 * Precios — página PÚBLICA (sin sesión) con la escalera de planes.
 *
 * Es el imán del embudo masivo: cualquiera la ve, compara los planes y entra a
 * /registro. Las tarjetas de planes viven en <PlanesGrid/> (compartido con la
 * landing); aquí solo se arma el encabezado con la marca y el pie.
 */

import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { RestaurantMenu } from '@mui/icons-material';
import { useBrandingStore } from '../store/brandingStore';
import { PlanesGrid } from '../components/planes/PlanesGrid';

export function Precios() {
  const navigate = useNavigate();
  const { nombreSistema, logoUrl } = useBrandingStore();

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

        {/* ── Tarjetas de planes (compartidas con la landing) ── */}
        <PlanesGrid />

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
