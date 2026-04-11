import { Users } from 'lucide-react'

export function MembersPage() {
  return (
    <div className="page-container page-container-wide">
      <div className="flex items-center gap-3 mb-8">
        <Users className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
        <div>
          <p className="page-eyebrow">Settings</p>
          <h1 className="page-title">Members</h1>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        Members management is coming in the next phase.
      </p>
    </div>
  )
}
