import { Flag } from 'lucide-react'

export function HomePage() {
  return (
    <div className="page-container page-container-wide">
      <div className="flex items-center gap-3 mb-8">
        <Flag className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
        <div>
          <p className="page-eyebrow">Dashboard</p>
          <h1 className="page-title">Feature flags</h1>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        No flags yet. Flags management is coming in the next phase.
      </p>
    </div>
  )
}
