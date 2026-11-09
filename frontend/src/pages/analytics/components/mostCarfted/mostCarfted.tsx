import React, { useEffect, useMemo, useState } from 'react';
import './mostCarfted.css';
import unitIcon from '../../../../assets/images/uniitIcon.png';
import unitIconWhite from '../../../../assets/images/uniitIconWhite.png';
import FilterSelect from '../../../../components/common/FilterSelect';
import { useApi, useThemeAwareIcon } from '../../../../hooks';
import LoadError from '../../../../components/common/LoadError';

type SortOrder = 'high' | 'low';

type SortOption = {
  value: SortOrder;
  label: string;
};

type CraftedBlueprint = {
  name: string;
  crafted: number;
};

const sortOptions: SortOption[] = [
  { value: 'high', label: 'High to low' },
  { value: 'low', label: 'Low to high' },
];

function normalizeString(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

const MostCrafted: React.FC = () => {
  const api = useApi();
  const [sortOrder, setSortOrder] = useState<SortOrder>('high');
  const [blueprints, setBlueprints] = useState<CraftedBlueprint[]>([]);
  // Load status for the list; bumping loadAttempt re-runs the load (Retry)
  const [loadStatus, setLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const unitIconSrc = useThemeAwareIcon(unitIcon, unitIconWhite);

  useEffect(() => {
    const loadMostCrafted = async () => {
      setLoadStatus('loading');
      try {
        const response = await api.get<any[]>('/Order');
        const orders = response.data ?? [];

        const totals = orders.reduce((map: Map<string, number>, order) => {
          const status = normalizeString(order.status);
          if (status !== 'complete' && status !== 'completed') {
            return map;
          }

          const itemName = String(order.itemName ?? order.ItemName ?? '').trim();
          const itemQuantity = Number(order.quantity ?? order.Quantity ?? 0);

          if (!itemName || itemQuantity <= 0) {
            return map;
          }

          map.set(itemName, (map.get(itemName) ?? 0) + itemQuantity);
          return map;
        }, new Map<string, number>());

        setBlueprints(
          Array.from(totals.entries()).map(([name, crafted]) => ({ name, crafted })),
        );
        setLoadStatus('loaded');
      } catch (error) {
        console.error('Unable to load most crafted blueprints', error);
        setBlueprints([]);
        setLoadStatus('error');
      }
    };

    loadMostCrafted();
  }, [api, loadAttempt]);

  const sortedBlueprints = useMemo(() => {
    return [...blueprints].sort((a, b) => {
      if (sortOrder === 'low') return a.crafted - b.crafted;
      return b.crafted - a.crafted;
    });
  }, [blueprints, sortOrder]);

  return (
    <section className="blueprint-panel most-crafted-card">
      <div className="blueprint-header">
        <div>
          <h3>Most Crafted Blueprints</h3>
        </div>
        <div className="blueprint-filter">
          <label htmlFor="mostCraftedSort">Sort</label>
          <FilterSelect
            value={sortOrder}
            onChange={(nextValue) => setSortOrder(nextValue as SortOrder)}
            ariaLabel="Most crafted sort order"
            options={sortOptions}
          />
        </div>
      </div>

      <div className="blueprint-list most-crafted-list">
        {loadStatus === 'loading' ? (
          <p className="most-crafted-empty">Loading crafted blueprints...</p>
        ) : loadStatus === 'error' ? (
          <LoadError what="crafted blueprints" onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />
        ) : sortedBlueprints.length === 0 ? (
          <p className="most-crafted-empty">No completed craft data available yet.</p>
        ) : (
          sortedBlueprints.map((blueprint) => (
            <button key={blueprint.name} type="button" className="blueprint-card">
              <div className="blueprint-card-main">
                <img src={unitIconSrc} alt="Blueprint icon" className="blueprint-card-icon" />
                <div>
                  <h4>{blueprint.name}</h4>
                </div>
              </div>
              <div className="blueprint-card-meta">
                <div className="meta-block">
                  <span className="meta-label">Crafted</span>
                  <strong>{blueprint.crafted}</strong>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
};

export default MostCrafted;
