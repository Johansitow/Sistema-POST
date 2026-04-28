/**
 * ErrorBoundary — Captura errores de React en componentes hijos.
 *
 * Uso:
 *   <ErrorBoundary>
 *     <MiComponente />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<p>Error personalizado</p>}>
 *     <MiComponente />
 *   </ErrorBoundary>
 *
 * Las funciones async/await NO son capturadas (solo errores de render).
 * Para errores de peticiones API, usar try/catch en el componente.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Box, Typography, Button, Paper, Divider } from '@mui/material';
import { BugReport, Refresh } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  /** UI alternativa a mostrar. Por defecto: pantalla de error integrada */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // En producción, aquí se enviaría a un servicio de monitoreo (Sentry, etc.)
    console.error('[ErrorBoundary] Error capturado:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (!hasError) return children;

    if (fallback) return fallback;

    const isDev = import.meta.env.DEV;

    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          p: 3,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            maxWidth: 520,
            width: '100%',
            p: 4,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'error.light',
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: 'error.lighter',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <BugReport sx={{ fontSize: 32, color: 'error.main' }} />
          </Box>

          <Typography variant="h5" fontWeight={700} gutterBottom>
            Algo salió mal
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Ocurrió un error inesperado en esta sección. Puedes intentar recargar
            la página o contactar a soporte si el problema persiste.
          </Typography>

          {isDev && error && (
            <>
              <Divider sx={{ mb: 2 }} />
              <Box
                sx={{
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  p: 1.5,
                  mb: 3,
                  textAlign: 'left',
                  overflowX: 'auto',
                }}
              >
                <Typography
                  variant="caption"
                  component="pre"
                  sx={{ fontFamily: 'monospace', color: 'error.dark', whiteSpace: 'pre-wrap', m: 0 }}
                >
                  {error.message}
                </Typography>
              </Box>
            </>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={this.handleReset}
            >
              Reintentar
            </Button>
            <Button
              variant="outlined"
              onClick={() => window.location.reload()}
            >
              Recargar página
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }
}
