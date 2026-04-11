import { Boxes } from 'lucide-react'

export function EnvironmentsPage() {
  return (
    <div className="page-container page-container-wide">
      <div className="flex items-center gap-3 mb-8">
        <Boxes className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
        <div>
          <p className="page-eyebrow">Settings</p>
          <h1 className="page-title">Environments</h1>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        Environment management is coming in the next phase.
      </p>
    </div>
  )
}
