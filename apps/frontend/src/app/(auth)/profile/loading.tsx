export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 h-8 w-40 animate-pulse rounded-md bg-background-main" />
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-background-surface p-6 shadow-card">
            <div className="mb-4 h-6 w-48 animate-pulse rounded-md bg-background-main" />
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-4 w-64 animate-pulse rounded-md bg-background-main" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
