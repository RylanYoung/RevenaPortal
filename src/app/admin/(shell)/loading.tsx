/** Instant feedback on admin navigation; see the portal one for why. */
export default function AdminLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Loading">
      <div className="mb-6">
        <Bar className="h-8 w-48" />
        <Bar className="h-4 w-64 mt-3" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-5">
            <Bar className="h-3 w-24" />
            <Bar className="h-8 w-14 mt-3" />
          </div>
        ))}
      </div>

      <div className="grid gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-5">
            <Bar className="h-5 w-40" />
            <Bar className="h-3 w-56 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-panel animate-pulse ${className}`} />;
}
