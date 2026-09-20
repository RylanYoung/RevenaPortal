/**
 * Shown the instant a navigation starts, while the server fetches.
 *
 * The data still takes as long as it takes — this doesn't make anything
 * faster. What it changes is that a click responds immediately instead of the
 * browser sitting on the old page looking frozen.
 */
export default function PortalLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Loading">
      <div className="mb-8">
        <Bar className="h-10 w-64" />
        <Bar className="h-5 w-48 mt-3" />
      </div>

      <div className="card p-8 sm:p-10 mb-8">
        <Bar className="h-4 w-32" />
        <Bar className="h-16 w-72 mt-4" />
        <Bar className="h-4 w-full mt-6 rounded-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-6">
            <Bar className="h-4 w-28" />
            <Bar className="h-9 w-16 mt-3" />
          </div>
        ))}
      </div>

      <div className="grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-5">
            <Bar className="h-6 w-48" />
            <Bar className="h-4 w-64 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-panel animate-pulse ${className}`} />;
}
