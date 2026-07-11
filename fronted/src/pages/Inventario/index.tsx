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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100">
      {/* Header del módulo */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" /> Inventario
          </h1>
        </div>
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => navigate(`/inventario${t.path ? '/' + t.path : ''}`)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab.key === t.key
                  ? (t.key === 'devoluciones' ? 'border-violet-600 text-violet-700' : 'border-indigo-600 text-indigo-700')
                  : 'border-transparent text-slate-500 hover:text-slate-700'
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
