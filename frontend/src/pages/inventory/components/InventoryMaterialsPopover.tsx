import { useMemo } from 'react';
import { InventoryMaterialDetails } from '../../../services/inventoryApi';

type InventoryMaterialsPopoverProps = {
  details: InventoryMaterialDetails | null;
  loading: boolean;
  compact?: boolean;
};

function InventoryMaterialsPopover({ details, loading, compact = false }: InventoryMaterialsPopoverProps) {
  const branchSummary = useMemo(() => {
    if (!details) {
      return [] as Array<{ branchName: string; quantity: number }>;
    }

    const summary = new Map<string, number>();

    details.ingredients.forEach((ingredient) => {
      ingredient.branches.forEach((branch) => {
        summary.set(branch.branchName, (summary.get(branch.branchName) ?? 0) + branch.quantity);
      });
    });

    return Array.from(summary.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([branchName, quantity]) => ({ branchName, quantity }));
  }, [details]);

  return (
    <div className={`rounded-2xl border border-border bg-surface shadow-[0_24px_60px_rgba(15,23,42,0.12)] ${compact ? 'overflow-hidden' : ''}`} role="region" aria-label="Inventory materials details">
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Materials</p>
          <h3 className="mt-1 text-base font-semibold text-text">
            {details ? details.itemName : 'Loading materials...'}
          </h3>
          {details ? (
            <p className="mt-1 text-xs text-muted">
              {details.category} · Production time {details.productionTime} min
            </p>
          ) : null}
        </div>
        <span className="rounded-full border border-border bg-app px-2.5 py-1 text-[11px] font-medium text-muted">
          {loading ? 'Fetching' : details ? `${details.ingredients.length} ingredients` : 'No data'}
        </span>
      </div>

      <div className="max-h-[28rem] overflow-auto px-4 py-3">
        {loading ? (
          <p className="text-sm text-muted">Loading live ingredient availability...</p>
        ) : details && details.ingredients.length > 0 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-app p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Branch summary</p>
              {branchSummary.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {branchSummary.map((branch) => (
                    <span key={branch.branchName} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text">
                      {branch.branchName}: {branch.quantity}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">No branch totals are available yet.</p>
              )}
            </div>

            {details.ingredients.map((ingredient) => {
              const missing = Math.max(0, ingredient.requiredQuantity - ingredient.availableQuantity);

              return (
                <div key={ingredient.ingredientId} className="rounded-xl border border-border bg-app p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-text">{ingredient.name}</p>
                      <p className="text-xs text-muted">{ingredient.category}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                      <span className="rounded-full bg-bg px-2 py-1 text-muted">Required: {ingredient.requiredQuantity}</span>
                      <span className="rounded-full bg-okBg px-2 py-1 text-okText">Available: {ingredient.availableQuantity}</span>
                      <span className="rounded-full bg-dangerBg px-2 py-1 text-dangerText">Missing: {missing}</span>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-border pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Branch stock</p>
                    {ingredient.branches.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ingredient.branches.map((branch) => (
                          <span key={`${ingredient.ingredientId}-${branch.branchName}`} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text">
                            {branch.branchName}: {branch.quantity}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted">No branch stock recorded for this ingredient.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2 text-sm text-muted">
            <p>No blueprint ingredients were found for this item.</p>
            <p>Live inventory availability will appear here when the backend has matching material data.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default InventoryMaterialsPopover;
