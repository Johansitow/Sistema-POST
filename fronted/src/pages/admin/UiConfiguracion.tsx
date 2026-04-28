/**
 * UiConfiguracion — redirige a /admin/apariencia
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function UiConfiguracion() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/admin/apariencia', { replace: true });
  }, [navigate]);
  return null;
}
