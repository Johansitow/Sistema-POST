/**
 * Landing — home PÚBLICO de marketing (sin sesión). Es la primera pantalla que ve
 * cualquier visitante: explica qué es el producto, TODO lo que hace hoy, muestra los
 * planes con precios y lo invita a crear cuenta o iniciar sesión.
 *
 * La marca (nombre/logo/color) sale de brandingStore, que carga sin sesión. Los
 * planes salen de <PlanesGrid/> (compartido con /precios). El contenido de módulos y
 * arquetipos vive en arreglos de datos al inicio del archivo para que agregar o quitar
 * capacidades sea trivial y no haya que tocar el JSX.
 *
 * Redirección: si el visitante ya tiene sesión válida (verificada por el bootstrap
 * de App antes de montar las rutas), lo enviamos directo al panel — no tiene sentido
 * mostrarle el material de venta a quien ya es cliente.
 */

import { useNavigate, Navigate } from 'react-router-dom';
import {
  AppBar, Toolbar, Box, Button, Container, Typography, Paper, Divider, Chip,
  List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  RestaurantMenu, PointOfSale, SoupKitchen, Inventory2, MenuBook, LocalShipping,
  Loyalty, QueryStats, Payments, Storefront, Badge, Bolt, VerifiedUser, Palette,
  RocketLaunch, CheckCircleOutline, ShieldOutlined, CheckCircle,
} from '@mui/icons-material';
import { useAuthStore } from '../store/useStore';
import { useBrandingStore } from '../store/brandingStore';
import { PlanesGrid } from '../components/planes/PlanesGrid';

/** Módulos del sistema — cada tarjeta con lo que un dueño de restaurante puede hacer. */
const MODULOS: { icon: typeof PointOfSale; titulo: string; bullets: string[] }[] = [
  {
    icon: PointOfSale,
    titulo: 'Punto de venta y cobro',
    bullets: [
      'Pedidos en mesa, para llevar y domicilio',
      'Varios métodos de pago en una misma cuenta',
      'Cancelación con reverso automático de stock',
      'Imprime comanda y factura al instante',
    ],
  },
  {
    icon: SoupKitchen,
    titulo: 'Cocina en tiempo real (KDS)',
    bullets: [
      'Tablero Nuevas → En preparación → Listas',
      'Avanza el estado con un solo clic',
      'Se actualiza solo, sin recargar',
      'Pantalla de pared, pensada para la cocina',
    ],
  },
  {
    icon: Inventory2,
    titulo: 'Inventario, lotes y mermas',
    bullets: [
      'Stock independiente por cada sede',
      'Alertas automáticas de stock bajo',
      'Lotes con control de vencimiento',
      'Valor de inventario y de la merma',
    ],
  },
  {
    icon: MenuBook,
    titulo: 'Recetas y rentabilidad',
    bullets: [
      'Costo y margen real de cada plato',
      'Cuántas unidades alcanza tu stock',
      'Recetas por fases de preparación',
      'Avisa qué ingredientes faltan',
    ],
  },
  {
    icon: LocalShipping,
    titulo: 'Compras y proveedores',
    bullets: [
      'Directorio de proveedores y contactos',
      'Precios de compra por proveedor',
      'Listas de compra manuales o automáticas',
      'Se generan solas cuando baja el stock',
    ],
  },
  {
    icon: Loyalty,
    titulo: 'Clientes y fidelización',
    bullets: [
      'Base de clientes con historial de compras',
      'Direcciones guardadas para domicilios',
      'Programa de puntos y canjes',
      'Top de clientes en tus reportes',
    ],
  },
  {
    icon: QueryStats,
    titulo: 'Reportes y dashboard',
    bullets: [
      'Ventas por día, producto, categoría y hora',
      'Métodos de pago y productos más vendidos',
      'Mermas y tendencias de consumo',
      'Consolidado de todas tus sedes',
    ],
  },
  {
    icon: Payments,
    titulo: 'Caja y cierre de turno',
    bullets: [
      'Turnos con apertura y base inicial',
      'Cierre con conteo y descuadre',
      'Bloquea el cierre si hay órdenes abiertas',
      'Historial completo de cierres',
    ],
  },
  {
    icon: Storefront,
    titulo: 'Varias sedes en un lugar',
    bullets: [
      'Grupo de negocio con varias sucursales',
      'Datos aislados y seguros por sede',
      'Usuarios asignados a cada sucursal',
      'Dashboard consolidado del grupo',
    ],
  },
  {
    icon: Badge,
    titulo: 'Equipo y nómina (Colombia)',
    bullets: [
      'Ficha 360 y hoja de vida del empleado',
      'Nómina colombiana real (salud, pensión, ARL, retención)',
      'Documentos laborales con verificación por QR',
      'Portal de autoservicio para el trabajador',
    ],
  },
];

/** Arquetipos del asistente de configuración — comunica que se adapta a cada negocio. */
const ARQUETIPOS = [
  'Cocina oculta (dark kitchen)',
  'Restaurante con mesas',
  'Comida rápida',
  'Cafetería y panadería',
  'Bar',
  'Franquicia',
];

/** Razones para elegir Krezco por encima de una libreta o un Excel. */
const DIFERENCIADORES: { icon: typeof Bolt; titulo: string; texto: string }[] = [
  {
    icon: Bolt,
    titulo: 'Todo en tiempo real',
    texto: 'Cocina, caja y administración sincronizadas al instante. Lo que pasa en una pantalla se ve en las demás.',
  },
  {
    icon: VerifiedUser,
    titulo: 'Nómina y documentos legales',
    texto: 'Liquidación colombiana real y certificados laborales verificables por QR. Cumples sin hojas de cálculo.',
  },
  {
    icon: Palette,
    titulo: 'Con tu propia marca',
    texto: 'Tu nombre, tu logo y tu color en todo el sistema. Tus clientes ven tu marca, no la nuestra.',
  },
  {
    icon: RocketLaunch,
    titulo: 'Empieza gratis hoy',
    texto: 'Crea tu cuenta en minutos, sin tarjeta ni contratos. El asistente configura el sistema por ti.',
  },
];

export function Landing() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { nombreSistema, logoUrl } = useBrandingStore();
  const { isAuthenticated, accessToken } = useAuthStore();

  // Ya es cliente con sesión válida → al panel, no al material de venta.
  if (isAuthenticated && accessToken) return <Navigate to="/dashboard" replace />;

  const anio = new Date().getFullYear();

  return (
    <Box sx={{ bgcolor: 'background.default' }}>

      {/* ── Barra superior ─────────────────────────────────────────────── */}
      <AppBar position="sticky" elevation={0} color="default"
        sx={{ bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
            {logoUrl
              ? <Box component="img" src={logoUrl} alt={nombreSistema} sx={{ height: 32 }} />
              : <RestaurantMenu color="primary" />}
            <Typography variant="h6" fontWeight={800} color="text.primary">{nombreSistema}</Typography>
          </Box>
          <Button color="inherit" onClick={() => navigate('/login')} sx={{ fontWeight: 700 }}>
            Iniciar sesión
          </Button>
          <Button variant="contained" onClick={() => navigate('/registro')} sx={{ ml: 1, fontWeight: 700 }}>
            Crear cuenta gratis
          </Button>
        </Toolbar>
      </AppBar>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'relative', overflow: 'hidden', color: 'common.white',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
          py: { xs: 8, md: 12 },
          '&::before': {
            content: '""', position: 'absolute', width: 600, height: 600, borderRadius: '50%',
            background: `radial-gradient(circle, ${theme.palette.primary.main}33 0%, transparent 70%)`,
            top: -200, right: -100,
          },
        }}
      >
        <Container maxWidth="md" sx={{ position: 'relative', textAlign: 'center' }}>
          <Chip
            label="Punto de venta todo-en-uno para restaurantes"
            sx={{ mb: 3, bgcolor: 'rgba(255,255,255,0.12)', color: 'common.white', fontWeight: 600 }}
          />
          <Typography variant="h2" fontWeight={800} sx={{ letterSpacing: '-1px', mb: 2, fontSize: { xs: '2.4rem', md: '3.4rem' } }}>
            El sistema que hace crecer tu restaurante
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.8)', maxWidth: 720, mx: 'auto', mb: 4, fontWeight: 400 }}>
            {nombreSistema} reúne ventas, cocina, inventario, recetas, reportes, varias sedes
            y hasta la nómina de tu equipo en un solo lugar. Simple para el mesero, completo
            para el dueño. Empieza gratis hoy.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained" size="large" onClick={() => navigate('/registro')}
              sx={{ py: 1.5, px: 4, fontWeight: 700, fontSize: '1rem' }}
            >
              Crear cuenta gratis
            </Button>
            <Button
              variant="outlined" size="large" onClick={() => navigate('/login')}
              sx={{ py: 1.5, px: 4, fontWeight: 700, fontSize: '1rem', color: 'common.white', borderColor: 'rgba(255,255,255,0.5)',
                '&:hover': { borderColor: 'common.white', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              Iniciar sesión
            </Button>
          </Box>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mt: 2 }}>
            Sin tarjeta de crédito · Sin contratos · Listo en minutos
          </Typography>
        </Container>
      </Box>

      {/* ── Módulos: todo lo que incluye ───────────────────────────────── */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
          <Typography variant="h4" fontWeight={800} gutterBottom>Un sistema, todo tu restaurante</Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 680, mx: 'auto', fontWeight: 400 }}>
            Deja las libretas y las hojas de cálculo. Estas son las herramientas que ya vienen
            incluidas y trabajan conectadas entre sí.
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
          {MODULOS.map(({ icon: Icon, titulo, bullets }) => (
            <Paper key={titulo} elevation={0}
              sx={{ p: 3, height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3,
                transition: 'all .2s', '&:hover': { borderColor: 'primary.main', boxShadow: 3 } }}>
              <Box sx={{
                width: 48, height: 48, borderRadius: 2, mb: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: 'primary.main', color: 'common.white',
              }}>
                <Icon />
              </Box>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>{titulo}</Typography>
              <List dense disablePadding>
                {bullets.map((b, i) => (
                  <ListItem key={i} disableGutters sx={{ py: 0.15, alignItems: 'flex-start' }}>
                    <ListItemIcon sx={{ minWidth: 26, mt: 0.4 }}>
                      <CheckCircle color="primary" sx={{ fontSize: 16 }} />
                    </ListItemIcon>
                    <ListItemText primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }} primary={b} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          ))}
        </Box>
      </Container>

      {/* ── Arquetipos: se adapta a tu tipo de negocio ─────────────────── */}
      <Box sx={{ bgcolor: 'grey.50', py: { xs: 5, md: 8 } }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800} gutterBottom>Se configura para tu tipo de negocio</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 620, mx: 'auto', mb: 3 }}>
            Un asistente enciende automáticamente las funciones correctas según tu negocio.
            Elige tu perfil y empieza a vender sin configurar nada a mano.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
            {ARQUETIPOS.map(a => (
              <Chip key={a} label={a} variant="outlined" color="primary" sx={{ fontWeight: 600, py: 2 }} />
            ))}
          </Box>
        </Container>
      </Box>

      {/* ── Diferenciadores ────────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 3 }}>
          {DIFERENCIADORES.map(({ icon: Icon, titulo, texto }) => (
            <Box key={titulo} sx={{ textAlign: 'center', px: 1 }}>
              <Icon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>{titulo}</Typography>
              <Typography variant="body2" color="text.secondary">{texto}</Typography>
            </Box>
          ))}
        </Box>
      </Container>

      {/* ── Planes ─────────────────────────────────────────────────────── */}
      <Box sx={{ bgcolor: 'grey.50', py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
            <Typography variant="h4" fontWeight={800} gutterBottom>Planes y precios</Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 620, mx: 'auto', fontWeight: 400 }}>
              Empieza gratis y crece cuando lo necesites. Sin contratos, cancelas cuando quieras.
            </Typography>
          </Box>

          <PlanesGrid />

          {/* Nota honesta de expectativa: hoy el alta entra en plan Gratis; el cobro
              en línea (PSE/tarjeta) llega pronto. Evita prometer un pago que aún no se cobra. */}
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 3 }}>
            Hoy puedes empezar gratis al instante. La activación de los planes de pago (PSE y
            tarjeta) llega muy pronto; mientras tanto la activamos contigo.
          </Typography>
        </Container>
      </Box>

      {/* ── Confianza / cierre ─────────────────────────────────────────── */}
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 }, textAlign: 'center' }}>
        <ShieldOutlined color="primary" sx={{ fontSize: 40, mb: 1 }} />
        <Typography variant="h5" fontWeight={800} gutterBottom>Tus datos, seguros y en Colombia</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640, mx: 'auto', mb: 3 }}>
          Tratamos tu información conforme a la Ley 1581 de 2012 (Habeas Data). Cada negocio ve
          solo sus propios datos, con acceso por roles y registro de auditoría.
        </Typography>
        <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 4 }, justifyContent: 'center', flexWrap: 'wrap', mb: 5 }}>
          {['Sin contratos', 'Cancela cuando quieras', 'Soporte cercano'].map(t => (
            <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CheckCircleOutline color="primary" fontSize="small" />
              <Typography variant="body2" fontWeight={600}>{t}</Typography>
            </Box>
          ))}
        </Box>
        <Button variant="contained" size="large" onClick={() => navigate('/registro')}
          sx={{ py: 1.5, px: 5, fontWeight: 700, fontSize: '1rem' }}>
          Empieza gratis con {nombreSistema}
        </Button>
      </Container>

      {/* ── Pie ────────────────────────────────────────────────────────── */}
      <Divider />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {logoUrl
              ? <Box component="img" src={logoUrl} alt={nombreSistema} sx={{ height: 24 }} />
              : <RestaurantMenu color="primary" fontSize="small" />}
            <Typography variant="body2" color="text.secondary">
              © {anio} {nombreSistema} · Todos los derechos reservados
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" onClick={() => navigate('/login')}>Iniciar sesión</Button>
            <Button size="small" onClick={() => navigate('/registro')}>Crear cuenta</Button>
          </Box>
        </Box>
      </Container>

    </Box>
  );
}
