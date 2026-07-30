/**
 * Inventario — módulo unificado con 4 subsecciones:
 * Inventario (conteo/ajuste), Lotes, Producción y Devoluciones.
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Hash, Layers, RefreshCw } from 'lucide-react';
import { ProductosTab } from './ProductosTab';
import { LotesTab } from './LotesTab';
import { DevolucionesTab } from './DevolucionesTab';

type TabKey = 'productos' | 'lotes' | 'produccion' | 'devoluciones';

const TABS: { key: TabKey; label: string; icon: React.ReactNode; path: string }[] = [
  { key: 'productos',    label: 'Inventario',   icon: <Package className="w-3.5 h-3.5" />,   path: '' },
  { key: 'lotes',        label: 'Lotes',        icon: <Hash className="w-3.5 h-3.5" />,       path: 'lotes' },
  { key: 'produccion',   label: 'Producción',   icon: <Layers className="w-3.5 h-3.5" />,     path: 'produccion' },
  { key: 'devoluciones', label: 'Devoluciones', icon: <RefreshCw className="w-3.5 h-3.5" />,  path: 'devoluciones' },
];

export const Inventario: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const activeTab = TABS.find(t => t.path === (tab ?? '')) ?? TABS[0];

  return (
    <div className="space-y-6">
      {/* Encabezado del módulo. El fondo y el ancho los pone el <main> del
          Layout; aquí solo queda el título y la barra de pestañas.
          La pestaña activa usa el color de marca en vez del índigo/violeta
          quemados, que no significaban nada. */}
      <div className="border-b border-neutro-200">
        <h1 className="text-2xl font-bold text-neutro-800 flex items-center gap-2 mb-3">
          <Package className="w-6 h-6 text-brand-600" /> Inventario
        </h1>
        <div className="flex gap-1" role="tablist">
          {TABS.map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={activeTab.key === t.key}
              onClick={() => navigate(`/inventario${t.path ? '/' + t.path : ''}`)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab.key === t.key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-neutro-500 hover:text-neutro-700'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab.key === 'productos' && <ProductosTab />}
      {(activeTab.key === 'lotes' || activeTab.key === 'produccion') && (
        <LotesTab soloProduccion={activeTab.key === 'produccion'} />
      )}
      {activeTab.key === 'devoluciones' && <DevolucionesTab />}
    </div>
  );
};
