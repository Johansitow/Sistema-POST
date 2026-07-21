/**
 * FichaEmpleado — ficha 360 del empleado (/admin/personal/:id).
 *
 * Sustituye al modal de tres pestañas que vivía dentro de la tabla de usuarios:
 * un modal no aguanta la cantidad de datos de una ficha de personal ni permite
 * enlazar a una persona concreta. El listado (/admin/usuarios) sigue siendo el
 * punto de entrada y conserva el alta rápida.
 *
 * Esta página solo orquesta: cada pestaña es un componente de
 * components/personal.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Paper, Tab, Tabs } from '@mui/material';
import {
  AccountBalance, Badge as BadgeIcon, Insights, VpnKey,
} from '@mui/icons-material';
import type {
  Usuario, NominaEmpleado, HistorialSalario, ResumenEmpleado,
  UpdateUsuarioDto, NominaDto,
} from '../../types';
import { usuariosService } from '../../services/usuarios.service';
import { restaurantesService, type Restaurante } from '../../services/restaurantes.service';
import { useAuthStore } from '../../store/useStore';
import { useUIStore } from '../../store/uiStore';
import { LoadingScreen, ConfirmDialog } from '../../components/common';
import {
  FichaHeader, TabResumen, TabDatosEmpleado, TabNomina, InfoRow, ResetPasswordDialog,
} from '../../components/personal';
import { formatDateTime } from '../../utils/format';

export default function FichaEmpleado() {
  const { id } = useParams<{ id: string }>();
  const empleadoId = Number(id);
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const { usuario: usuarioActual, isSuperAdmin } = useAuthStore();

  const [tab, setTab]             = useState(0);
  const [empleado, setEmpleado]   = useState<Usuario | null>(null);
  const [nomina, setNomina]       = useState<NominaEmpleado | null>(null);
  const [historial, setHistorial] = useState<HistorialSalario[]>([]);
  const [resumen, setResumen]     = useState<ResumenEmpleado | null>(null);
  const [sedes, setSedes]         = useState<Restaurante[]>([]);
  const [jefes, setJefes]         = useState<Usuario[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [resetOpen, setResetOpen]     = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /**
   * El super admin solo puede ser gestionado por sí mismo, igual que en el
   * listado. La regla real vive en el backend; aquí solo se refleja en la UI.
   */
  const puedeGestionar = !empleado?.es_super_admin
    || (isSuperAdmin() && usuarioActual?.id === empleado?.id);

  const cargar = useCallback(async () => {
    if (!empleadoId || isNaN(empleadoId)) {
      setErrorCarga('Identificador de empleado inválido.');
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      // El resumen y los catálogos no deben tumbar la ficha si fallan
      const [emp, nom, hist] = await Promise.all([
        usuariosService.obtenerPorId(empleadoId),
        usuariosService.getNomina(empleadoId).catch(() => null),
        usuariosService.historialSalarios(empleadoId).catch(() => []),
      ]);
      setEmpleado(emp);
      setNomina(nom);
      setHistorial(hist);
      setErrorCarga('');

      usuariosService.resumen(empleadoId).then(setResumen).catch(() => setResumen(null));
      restaurantesService.listar().then(setSedes).catch(() => setSedes([]));
      usuariosService.listar({ limit: 100, estado: 'activo' })
        .then(r => setJefes((r.data as Usuario[]).filter(u => u.id !== empleadoId)))
        .catch(() => setJefes([]));
    } catch {
      setErrorCarga('No se pudo cargar la ficha del empleado.');
    } finally {
      setCargando(false);
    }
  }, [empleadoId]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleGuardarDatos = async (dto: UpdateUsuarioDto) => {
    await usuariosService.actualizar(empleadoId, dto);
    showToast('Ficha actualizada correctamente', 'success');
    await cargar();
  };

  const handleGuardarNomina = async (dto: NominaDto) => {
    await usuariosService.guardarNomina(empleadoId, dto);
    showToast('Nómina guardada correctamente', 'success');
    // Recargar historial: el backend pudo haber creado una fila nueva
    const [nom, hist] = await Promise.all([
      usuariosService.getNomina(empleadoId).catch(() => null),
      usuariosService.historialSalarios(empleadoId).catch(() => []),
    ]);
    setNomina(nom);
    setHistorial(hist);
  };

  const handleToggleEstado = async () => {
    if (!empleado) return;
    const nuevo = empleado.estado === 'activo' ? 'inactivo' : 'activo';
    try {
      await usuariosService.cambiarEstado(empleado.id, nuevo);
      showToast(nuevo === 'activo' ? 'Acceso activado' : 'Acceso desactivado', 'success');
      await cargar();
    } catch {
      showToast('No se pudo cambiar el estado de la cuenta', 'error');
    }
  };

  if (cargando) return <LoadingScreen />;

  if (errorCarga || !empleado) {
    return (
      <Box>
        <Alert
          severity="error"
          action={<Box component="button" onClick={() => navigate('/admin/usuarios')}
            sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', textDecoration: 'underline' }}>
            Volver
          </Box>}
        >
          {errorCarga || 'Empleado no encontrado.'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <FichaHeader
        empleado={empleado}
        puedeGestionar={puedeGestionar}
        onResetPassword={() => setResetOpen(true)}
        onToggleEstado={() => setConfirmOpen(true)}
      />

      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab icon={<Insights fontSize="small" />}        iconPosition="start" label="Resumen" />
          <Tab icon={<BadgeIcon fontSize="small" />}       iconPosition="start" label="Datos del empleado" />
          <Tab icon={<AccountBalance fontSize="small" />}  iconPosition="start" label="Nómina" />
          <Tab icon={<VpnKey fontSize="small" />}          iconPosition="start" label="Acceso al sistema" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tab === 0 && <TabResumen empleado={empleado} resumen={resumen} />}

          {tab === 1 && (
            <TabDatosEmpleado
              empleado={empleado}
              sedes={sedes}
              posiblesJefes={jefes}
              soloLectura={!puedeGestionar}
              onGuardar={handleGuardarDatos}
            />
          )}

          {tab === 2 && (
            <TabNomina
              nomina={nomina}
              historial={historial}
              soloLectura={!puedeGestionar}
              onGuardar={handleGuardarNomina}
            />
          )}

          {tab === 3 && (
            <Box sx={{ maxWidth: 520 }}>
              <InfoRow label="Usuario"        value={`@${empleado.usuario}`} mostrarVacio />
              <InfoRow label="Email"          value={empleado.email} mostrarVacio />
              <InfoRow label="Rol"            value={empleado.rol.nombre} mostrarVacio />
              <InfoRow
                label="Estado de la cuenta"
                value={empleado.estado === 'activo' ? 'Activa' : 'Desactivada'}
                mostrarVacio
              />
              <InfoRow
                label="Último acceso"
                value={empleado.ultimo_acceso ? formatDateTime(empleado.ultimo_acceso) : 'Nunca'}
                mostrarVacio
              />
              <InfoRow
                label="Creado"
                value={formatDateTime(empleado.fecha_creacion)}
                mostrarVacio
              />
              <InfoRow label="Creado por" value={empleado.creador?.nombre_completo} mostrarVacio />
              <Alert severity="info" sx={{ mt: 2 }}>
                El estado de la cuenta controla el acceso al sistema. El estado
                laboral (vacaciones, retirado…) se gestiona en la pestaña
                <strong> Datos del empleado</strong>.
              </Alert>
            </Box>
          )}
        </Box>
      </Paper>

      <ResetPasswordDialog
        open={resetOpen}
        nombre={empleado.nombre_completo}
        onClose={() => setResetOpen(false)}
        onConfirm={async (password) => {
          await usuariosService.resetPassword(empleado.id, password);
          showToast('Contraseña reseteada correctamente', 'success');
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={empleado.estado === 'activo' ? 'Desactivar acceso' : 'Activar acceso'}
        message={
          empleado.estado === 'activo'
            ? `¿Desactivar el acceso de "${empleado.nombre_completo}"? Su ficha e historial se conservan.`
            : `¿Activar el acceso de "${empleado.nombre_completo}"? Podrá volver a entrar al sistema.`
        }
        confirmText={empleado.estado === 'activo' ? 'Desactivar' : 'Activar'}
        confirmColor={empleado.estado === 'activo' ? 'error' : 'success'}
        onConfirm={handleToggleEstado}
        onClose={() => setConfirmOpen(false)}
      />
    </Box>
  );
}
