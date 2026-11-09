type LoadErrorProps = {
  // What failed to load, e.g. "inventory" -> "Couldn't load inventory."
  what: string;
  onRetry?: () => void;
  className?: string;
};

// Shown in place of a list when its data failed to load, so a failure is not mistaken for "nothing here"
function LoadError({ what, onRetry, className = '' }: LoadErrorProps) {
  return (
    <div role="alert" className={`flex flex-col items-center gap-2 rounded-xl border border-border bg-app p-4 text-center text-sm text-muted ${className}`}>
      <p>
        <strong className="font-semibold text-text">Couldn&apos;t load {what}.</strong> The server may be waking up, or
        your connection may be down.
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text transition hover:border-primary"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export default LoadError;
