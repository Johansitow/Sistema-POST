/**
 * Wizard de onboarding — 3 pasos + pantalla de contacto.
 *
 * Flujo:
 *   Paso 1 (arquetipo) → Paso 2 (ajuste de ejes) → Paso 3 (preview + confirmar)
 *   Cualquier paso 1 → pantalla de contacto (link "ninguno encaja")
 *
 * Modos:
 *   'onboarding' (default) — primer arranque; paso 3 puede confirmar y persistir.
 *   'prueba'               — exploración de solo lectura desde /admin; nunca llama
 *                            aplicar(). La garantía es estructural: onConfirmar no
 *                            se pasa a Paso3Revisar en modo prueba.
 *
 * Invariantes:
 *   - aplicar() solo se llama tras confirmar en paso 3 en modo 'onboarding'.
 *   - Ningún nombre técnico de flag/config llega al DOM (todo pasa por catalogo.ts).
 *   - El estado del wizard (arquetipo + overrides) se conserva al navegar atrás/adelante.
 */

export type ModoWizard = 'onboarding' | 'prueba';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, CircularProgress, Alert, Chip,
} from '@mui/material';
import {
  ArrowBack, ArrowForward, CheckCircleOutline, Check,
  PauseCircleOutline, Lock, HelpOutline, Message,
  WhatsApp, MailOutline, WarningAmber,
  TwoWheeler, DinnerDining, Fastfood, Coffee, SportsBar, Storefront,
} from '@mui/icons-material';
import { onboardingService } from '../../services/onboarding.service';
import { useFeatureFlagStore } from '../../store/featureFlagStore';
import {
  ARQUETIPOS_UI,
  PREGUNTAS_EJE,
  defaultsEjes,
  etiquetaFlag,
  etiquetaConfig,
} from '../../lib/onboarding/catalogo';
import type { PerfilResuelta } from '../../types/onboarding.types';

// ── Tipos internos ─────────────────────────────────────────────────────────────

type Paso = 1 | 2 | 3 | 'contacto';

interface WizardState {
  paso: Paso;
  arquetipo: string | null;
  overrides: Record<string, string>;
  preview: PerfilResuelta | null;
  previewLoading: boolean;
  applying: boolean;
  error: string | null;
}

// ── Ícono por arquetipo (fuera del catálogo para no mezclar React con datos puros) ─

const ICONOS_ARQUETIPO: Record<string, React.ReactElement> = {
  dark_kitchen:  <TwoWheeler    sx={{ fontSize: 24 }} />,
  con_mesas:     <DinnerDining  sx={{ fontSize: 24 }} />,
  comida_rapida: <Fastfood      sx={{ fontSize: 24 }} />,
  cafeteria:     <Coffee        sx={{ fontSize: 24 }} />,
  bar:           <SportsBar     sx={{ fontSize: 24 }} />,
  franquicia:    <Storefront    sx={{ fontSize: 24 }} />,
};

// ── Stepper header ─────────────────────────────────────────────────────────────

type EstadoStep = 'completado' | 'activo' | 'pendiente';

function StepIndicator({ n, estado, label }: { n: number; estado: EstadoStep; label: string }) {
  const colors = {
    completado: { bg: 'success.main', color: 'white' },
    activo:     { bg: 'primary.main', color: 'white' },
    pendiente:  { bg: 'transparent', color: 'text.disabled' },
  }[estado];

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        sx={{
          width: 22, height: 22, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: colors.bg, color: colors.color, fontSize: 12, fontWeight: 500,
          border: estado === 'pendiente' ? '1px solid' : 'none',
          borderColor: 'divider',
        }}
      >
        {estado === 'completado' ? <Check sx={{ fontSize: 13 }} /> : n}
      </Box>
      <Typography
        variant="caption"
        sx={{ color: estado === 'pendiente' ? 'text.disabled' : 'text.primary', fontWeight: estado === 'activo' ? 600 : 400 }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function WizardHeader({ paso }: { paso: Paso }) {
  if (paso === 'contacto') return null;
  const p = paso as 1 | 2 | 3;

  const estadoStep = (n: 1 | 2 | 3): EstadoStep => {
    if (p > n) return 'completado';
    if (p === n) return 'activo';
    return 'pendiente';
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, fontSize: 13 }}>
      <StepIndicator n={1} estado={estadoStep(1)} label="Tipo de restaurante" />
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
      <StepIndicator n={2} estado={estadoStep(2)} label="Ajustes" />
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
      <StepIndicator n={3} estado={estadoStep(3)} label="Revisar y aplicar" />
    </Box>
  );
}

// ── Paso 1 — Selección de arquetipo ────────────────────────────────────────────

function Paso1Arquetipo({
  arquetipo,
  onSelect,
  onSiguiente,
  onContacto,
}: {
  arquetipo: string | null;
  onSelect: (slug: string) => void;
  onSiguiente: () => void;
  onContacto: () => void;
}) {
  const seleccionado = ARQUETIPOS_UI.find(a => a.slug === arquetipo) ?? null;

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={0.5}>
        ¿Qué tipo de restaurante es el tuyo?
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Elige el que más se parezca. Verás qué incluye y podrás ajustar todo en el siguiente paso.
      </Typography>

      {/* Grid de tarjetas */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 1.5,
          mb: 1.5,
        }}
      >
        {ARQUETIPOS_UI.map(a => {
          const activo = a.slug === arquetipo;
          return (
            <Box
              key={a.slug}
              onClick={() => onSelect(a.slug)}
              sx={{
                bgcolor: 'background.paper',
                border: activo ? '2px solid' : '1px solid',
                borderColor: activo ? 'primary.main' : 'divider',
                borderRadius: 2,
                p: 2,
                cursor: 'pointer',
                position: 'relative',
                transition: 'border-color 0.15s',
                '&:hover': { borderColor: activo ? 'primary.main' : 'text.secondary' },
              }}
            >
              {activo && (
                <CheckCircleOutline
                  sx={{ position: 'absolute', top: 8, right: 8, fontSize: 20, color: 'primary.main' }}
                />
              )}
              <Box sx={{ color: activo ? 'primary.main' : 'text.secondary' }}>
                {ICONOS_ARQUETIPO[a.slug]}
              </Box>
              <Typography variant="body2" fontWeight={600} mt={1} mb={0.25}>
                {a.label}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {a.descripcion}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Panel "qué incluye" */}
      {seleccionado && (
        <Box
          sx={{
            bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
            borderRadius: 2, p: 2, mb: 2,
          }}
        >
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            {seleccionado.label} incluye:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {seleccionado.incluye.map(item => (
              <Chip key={item.label} label={item.label} size="small" variant="outlined" />
            ))}
          </Box>
        </Box>
      )}

      {/* Footer */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
        <Button
          startIcon={<HelpOutline />}
          size="small"
          sx={{ color: 'primary.main', textTransform: 'none' }}
          onClick={onContacto}
        >
          ¿Ninguno encaja? Cuéntanos tu caso
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button disabled>Atrás</Button>
          <Button
            variant="outlined"
            endIcon={<ArrowForward />}
            disabled={!arquetipo}
            onClick={onSiguiente}
          >
            Siguiente
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

// ── Paso 2 — Ajuste de ejes ────────────────────────────────────────────────────

function Paso2Ejes({
  arquetipo,
  overrides,
  onChange,
  onAtras,
  onSiguiente,
}: {
  arquetipo: string;
  overrides: Record<string, string>;
  onChange: (eje: string, valor: string) => void;
  onAtras: () => void;
  onSiguiente: () => void;
}) {
  const arqUI = ARQUETIPOS_UI.find(a => a.slug === arquetipo);

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={0.5}>
        Ajusta lo que necesites
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2.5}>
        Dejamos esto preconfigurado para {arqUI?.label ?? 'tu tipo'}. Cambia solo lo que no encaje.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {PREGUNTAS_EJE.map(preg => {
          const valorActual = overrides[preg.eje] ?? '';

          if (preg.tipo === 'select') {
            return (
              <Box key={preg.eje}>
                <Typography variant="body2" fontWeight={600} mb={0.25}>{preg.pregunta}</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  {preg.ayuda}
                </Typography>
                <Box
                  component="select"
                  value={valorActual}
                  onChange={e => onChange(preg.eje, (e.target as HTMLSelectElement).value)}
                  sx={{
                    width: 220, p: '6px 10px', borderRadius: 1,
                    border: '1px solid', borderColor: 'divider',
                    bgcolor: 'background.paper', color: 'text.primary',
                    fontSize: 13, outline: 'none', cursor: 'pointer',
                  }}
                >
                  {preg.opciones.map(op => (
                    <option key={op.valor} value={op.valor}>{op.label}</option>
                  ))}
                </Box>
              </Box>
            );
          }

          // toggle
          return (
            <Box key={preg.eje}>
              <Typography variant="body2" fontWeight={600} mb={0.25}>{preg.pregunta}</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                {preg.ayuda}
              </Typography>
              <Box
                sx={{
                  display: 'inline-flex',
                  border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden',
                }}
              >
                {preg.opciones.map((op, i) => {
                  const activo = valorActual === op.valor;
                  return (
                    <Box
                      key={op.valor}
                      onClick={() => onChange(preg.eje, op.valor)}
                      sx={{
                        px: 1.75, py: 0.875, fontSize: 13, cursor: 'pointer',
                        bgcolor: activo ? 'primary.main' : 'background.paper',
                        color: activo ? 'primary.contrastText' : 'text.secondary',
                        fontWeight: activo ? 600 : 400,
                        borderLeft: i > 0 ? '1px solid' : 'none',
                        borderColor: 'divider',
                        transition: 'background-color 0.15s',
                        userSelect: 'none',
                      }}
                    >
                      {op.label}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={onAtras}>
          Atrás
        </Button>
        <Button variant="outlined" endIcon={<ArrowForward />} onClick={onSiguiente}>
          Revisar cambios
        </Button>
      </Box>
    </Box>
  );
}

// ── Paso 3 — Revisar y aplicar ─────────────────────────────────────────────────

function Paso3Revisar({
  preview,
  loading,
  applying,
  error,
  modo,
  onAtras,
  onConfirmar,
  onReiniciar,
}: {
  preview: PerfilResuelta | null;
  loading: boolean;
  applying: boolean;
  error: string | null;
  modo: ModoWizard;
  onAtras: () => void;
  onConfirmar?: () => void;  // undefined en modo prueba → no se puede aplicar
  onReiniciar: () => void;
}) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  // Items "se activará": flags habilitados + configs con etiqueta
  const itemsActivan = [
    ...(preview?.flags ?? [])
      .filter(f => f.habilitado)
      .map(f => etiquetaFlag(f.nombre))
      .filter((l): l is string => !!l),
    ...(preview?.configs ?? [])
      .map(c => etiquetaConfig(c.clave, c.valor))
      .filter((l): l is string => !!l),
  ];

  const huerfanos = preview?.desactivadosPorDependencia ?? [];
  const omitidos  = preview?.omitidosPorDependencia ?? [];

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={0.5}>
        Esto es lo que va a pasar
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Revisa los cambios antes de aplicarlos. Nada se guarda hasta que confirmes.
      </Typography>

      {/* Bloque: se activará */}
      {itemsActivan.length > 0 && (
        <Box
          sx={{
            bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
            borderRadius: 2, p: 2, mb: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
            <CheckCircleOutline sx={{ color: 'success.main', fontSize: 20 }} />
            <Typography variant="body2" fontWeight={600} color="success.main">
              Se activará
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {itemsActivan.map(label => (
              <Chip key={label} label={label} size="small" />
            ))}
          </Box>
        </Box>
      )}

      {/* Bloque: se desactivará (huérfanos) */}
      {huerfanos.length > 0 && (
        <Box
          sx={{
            bgcolor: 'background.paper', border: '1px solid', borderColor: 'warning.main',
            borderRadius: 2, p: 2, mb: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <PauseCircleOutline sx={{ color: 'warning.main', fontSize: 20 }} />
            <Typography variant="body2" fontWeight={600} color="warning.main">
              Se desactivará porque quedaría sin uso
            </Typography>
          </Box>
          {huerfanos.map(h => {
            const label = etiquetaFlag(h.clave) ?? h.clave;
            return (
              <Box key={h.clave} sx={{ display: 'flex', gap: 1, mt: 0.75 }}>
                <WarningAmber sx={{ color: 'warning.main', fontSize: 16, mt: '2px', flexShrink: 0 }} />
                <Typography variant="caption" color="text.secondary" lineHeight={1.6}>
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>
                    {label}
                  </Box>
                  {' '}— {h.motivo}. Si lo necesitas, puedes reactivarlo luego en Configuración.
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Bloque: no se tocará (bloqueados) */}
      {omitidos.length > 0 && (
        <Box
          sx={{
            bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
            borderRadius: 2, p: 2, mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Lock sx={{ color: 'text.secondary', fontSize: 20 }} />
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              No se tocará (bloqueado por un administrador)
            </Typography>
          </Box>
          {omitidos.map(o => {
            const label = etiquetaFlag(o.clave) ?? o.clave;
            return (
              <Box key={o.clave} sx={{ display: 'flex', gap: 1, mt: 0.75 }}>
                <Box component="span" sx={{ color: 'text.secondary', fontSize: 14, mt: '1px', flexShrink: 0 }}>—</Box>
                <Typography variant="caption" color="text.secondary" lineHeight={1.6}>
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>
                    {label}
                  </Box>
                  {' '}— está marcada como no editable, así que el wizard la deja como está.
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Error de aplicar */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Button startIcon={<ArrowBack />} onClick={onAtras} disabled={applying}>
          Atrás
        </Button>

        {modo === 'prueba' ? (
          /* Modo prueba: solo lectura. No hay botón de aplicar. */
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Alert severity="info" icon={false} sx={{ py: 0.5, px: 1.5, fontSize: 13 }}>
              Modo prueba — esta vista previa no guarda nada.
            </Alert>
            <Button variant="outlined" onClick={onReiniciar}>
              Probar otra configuración
            </Button>
          </Box>
        ) : (
          /* Modo onboarding: puede confirmar y persistir. */
          <Button
            variant="contained"
            startIcon={applying ? <CircularProgress size={16} color="inherit" /> : <Check />}
            onClick={onConfirmar}
            disabled={applying || loading}
          >
            {applying ? 'Aplicando…' : 'Confirmar y aplicar'}
          </Button>
        )}
      </Box>
    </Box>
  );
}

// ── Pantalla de contacto ───────────────────────────────────────────────────────

function ContactoPanel({ onVolver }: { onVolver: () => void }) {
  return (
    <Box sx={{ maxWidth: 440, mx: 'auto', textAlign: 'center', py: 2 }}>
      <Box
        sx={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 56, height: 56, borderRadius: '50%',
          bgcolor: 'primary.main', color: 'white', mb: 2,
        }}
      >
        <Message sx={{ fontSize: 28 }} />
      </Box>

      <Typography variant="h6" fontWeight={600} mb={1}>
        Tu caso merece una configuración a medida
      </Typography>
      <Typography variant="body2" color="text.secondary" lineHeight={1.7} mb={3}>
        Si ninguno de los tipos encaja del todo, no improvises una configuración que podría no
        ajustarse a tu operación. Escríbenos y armamos juntos el arreglo exacto para tu restaurante.
      </Typography>

      <Box
        sx={{
          bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
          borderRadius: 2, p: 2, textAlign: 'left', mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
          <WhatsApp sx={{ fontSize: 20, color: 'text.secondary' }} />
          {/* TODO: reemplazar por número real */}
          <Typography variant="body2">+57 300 000 0000</Typography>
        </Box>
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.25,
            pt: 1.5, borderTop: '1px solid', borderColor: 'divider',
          }}
        >
          <MailOutline sx={{ fontSize: 20, color: 'text.secondary' }} />
          {/* TODO: reemplazar por correo real */}
          <Typography variant="body2" color="primary.main">soporte@tupos.co</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
        <Button startIcon={<ArrowBack />} onClick={onVolver}>
          Volver a los tipos
        </Button>
        {/* TODO: reemplazar href por número real */}
        <Button
          variant="contained"
          startIcon={<WhatsApp />}
          href="https://wa.me/573000000000"
          target="_blank"
          rel="noopener noreferrer"
        >
          Escribir por WhatsApp
        </Button>
      </Box>
    </Box>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function WizardOnboarding({ modo = 'onboarding' }: { modo?: ModoWizard }) {
  const navigate = useNavigate();
  const reloadFlags = useFeatureFlagStore(s => s.reloadFlags);

  const [state, setState] = useState<WizardState>({
    paso:           1,
    arquetipo:      null,
    overrides:      {},
    preview:        null,
    previewLoading: false,
    applying:       false,
    error:          null,
  });

  const set = (partial: Partial<WizardState>) =>
    setState(prev => ({ ...prev, ...partial }));

  // ── Reiniciar al paso 1 (modo prueba: "probar otra configuración") ───────────
  function reiniciar() {
    setState(prev => ({
      ...prev,
      paso: 1, arquetipo: null, overrides: {},
      preview: null, previewLoading: false, applying: false, error: null,
    }));
  }

  // ── Paso 1 → Paso 2 ─────────────────────────────────────────────────────────
  function irPaso2() {
    if (!state.arquetipo) return;
    set({ paso: 2, overrides: defaultsEjes(state.arquetipo), error: null });
  }

  // ── Paso 2 → Paso 3 (llama preview) ─────────────────────────────────────────
  async function irPaso3() {
    if (!state.arquetipo) return;
    set({ paso: 3, previewLoading: true, preview: null, error: null });
    try {
      const preview = await onboardingService.previsualizar({
        arquetipo: state.arquetipo,
        ejes: state.overrides,
      });
      set({ preview, previewLoading: false });
    } catch {
      set({
        previewLoading: false,
        error: 'No se pudo cargar el resumen. Verifica tu conexión e intenta de nuevo.',
      });
    }
  }

  // ── Confirmar y aplicar ──────────────────────────────────────────────────────
  async function confirmar() {
    if (!state.arquetipo) return;
    set({ applying: true, error: null });
    try {
      await onboardingService.aplicar({
        arquetipo: state.arquetipo,
        ejes: state.overrides,
      });
      await reloadFlags();
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg =
        status === 403
          ? 'No tienes permiso para aplicar el onboarding. Pídele al administrador que lo complete.'
          : 'Ocurrió un error al aplicar la configuración. Intenta de nuevo.';
      set({ applying: false, error: msg });
    }
  }

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        borderRadius: 3, p: 2.5,
        maxWidth: 680, mx: 'auto', mt: 3,
      }}
    >
      <WizardHeader paso={state.paso} />

      {state.paso === 1 && (
        <Paso1Arquetipo
          arquetipo={state.arquetipo}
          onSelect={slug => set({ arquetipo: slug })}
          onSiguiente={irPaso2}
          onContacto={() => set({ paso: 'contacto' })}
        />
      )}

      {state.paso === 2 && state.arquetipo && (
        <Paso2Ejes
          arquetipo={state.arquetipo}
          overrides={state.overrides}
          onChange={(eje, valor) => set({ overrides: { ...state.overrides, [eje]: valor } })}
          onAtras={() => set({ paso: 1, error: null })}
          onSiguiente={irPaso3}
        />
      )}

      {state.paso === 3 && (
        <Paso3Revisar
          preview={state.preview}
          loading={state.previewLoading}
          applying={state.applying}
          error={state.error}
          modo={modo}
          onAtras={() => set({ paso: 2, error: null })}
          onConfirmar={modo === 'onboarding' ? confirmar : undefined}
          onReiniciar={reiniciar}
        />
      )}

      {state.paso === 'contacto' && (
        <ContactoPanel onVolver={() => set({ paso: 1 })} />
      )}
    </Box>
  );
}
