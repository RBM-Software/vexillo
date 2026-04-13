import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { Building2, KeyRound, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function createOrg(body: {
  name: string
  slug: string
  oktaClientId: string
  oktaClientSecret: string
  oktaIssuer: string
}): Promise<{ slug: string }> {
  const res = await fetch('/api/superadmin/orgs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to create organization')
  return data.org
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background shadow-surface-xs">
        <Icon className="h-4 w-4 text-foreground/70" strokeWidth={1.75} />
      </span>
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {children}
      </span>
    </div>
  )
}

export function AdminNewOrgDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [oktaClientId, setOktaClientId] = useState('')
  const [oktaClientSecret, setOktaClientSecret] = useState('')
  const [oktaIssuer, setOktaIssuer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setName('')
      setSlug('')
      setSlugEdited(false)
      setOktaClientId('')
      setOktaClientSecret('')
      setOktaIssuer('')
      setSubmitting(false)
    }
  }, [open])

  function handleNameChange(value: string) {
    setName(value)
    if (!slugEdited) setSlug(slugify(value))
  }

  function handleSlugChange(value: string) {
    setSlug(value)
    setSlugEdited(true)
  }

  const canSubmit =
    name.trim() &&
    slug.trim() &&
    oktaClientId.trim() &&
    oktaClientSecret.trim() &&
    oktaIssuer.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const org = await createOrg({
        name: name.trim(),
        slug: slug.trim() || slugify(name),
        oktaClientId: oktaClientId.trim(),
        oktaClientSecret: oktaClientSecret.trim(),
        oktaIssuer: oktaIssuer.trim(),
      })
      toast.success(`"${name.trim()}" created`)
      onOpenChange(false)
      navigate({ to: '/admin/orgs/$slug', params: { slug: org.slug } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create organization')
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={!submitting}
        className={cn(
          'max-h-[min(92dvh,48rem)] max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-xl',
        )}
      >
        <div className="relative border-b border-border/80 bg-linear-to-b from-muted/50 to-card dark:from-muted/25">
          <div
            className="pointer-events-none absolute -right-16 -top-24 h-40 w-40 rounded-full bg-foreground/4 blur-3xl dark:bg-white/5"
            aria-hidden
          />
          <DialogHeader className="relative gap-0 px-6 pt-6 pb-5 text-left">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border/90 bg-background shadow-surface-xs">
                <Building2 className="h-6 w-6 text-foreground/85" strokeWidth={1.5} />
              </span>
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                <p className="page-eyebrow">Provisioning</p>
                <DialogTitle className="font-heading text-xl font-medium tracking-[-0.02em] text-foreground sm:text-[1.375rem]">
                  New organization
                </DialogTitle>
                <DialogDescription className="text-[0.8125rem] leading-relaxed text-pretty">
                  Define the tenant identity and the Okta OIDC app this workspace will use
                  for sign-in.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-0 overflow-y-auto overscroll-contain px-6 py-5">
            <fieldset className="space-y-4 border-0 p-0">
              <legend className="sr-only">Organization</legend>
              <SectionLabel icon={Layers}>Organization</SectionLabel>

              <div className="space-y-4 pl-0.5 sm:pl-10">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-new-org-name" className="text-foreground">
                    Display name
                  </Label>
                  <Input
                    id="admin-new-org-name"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    required
                    autoFocus={open}
                    disabled={submitting}
                    className="h-10 transition-shadow focus-visible:shadow-surface-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-new-org-slug">URL slug</Label>
                  <Input
                    id="admin-new-org-slug"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="e.g. acme-corp"
                    className="h-10 font-mono text-sm tracking-tight"
                    disabled={submitting}
                  />
                  <p className="text-[0.75rem] leading-snug text-muted-foreground">
                    Appears in routes and APIs. Fills from the display name until you edit it.
                  </p>
                </div>
              </div>
            </fieldset>

            <Separator className="my-6 bg-border/80" />

            <fieldset className="space-y-4 border-0 p-0">
              <legend className="sr-only">Okta</legend>
              <SectionLabel icon={KeyRound}>Okta OIDC</SectionLabel>

              <div className="space-y-4 pl-0.5 sm:pl-10">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-new-org-okta-client-id">Client ID</Label>
                  <Input
                    id="admin-new-org-okta-client-id"
                    value={oktaClientId}
                    onChange={(e) => setOktaClientId(e.target.value)}
                    placeholder="0oa..."
                    required
                    className="h-10 font-mono text-sm tracking-tight"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-new-org-okta-client-secret">Client secret</Label>
                  <Input
                    id="admin-new-org-okta-client-secret"
                    type="password"
                    value={oktaClientSecret}
                    onChange={(e) => setOktaClientSecret(e.target.value)}
                    required
                    className="h-10"
                    disabled={submitting}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-new-org-okta-issuer">Issuer URL</Label>
                  <Input
                    id="admin-new-org-okta-issuer"
                    value={oktaIssuer}
                    onChange={(e) => setOktaIssuer(e.target.value)}
                    placeholder="https://your-org.okta.com/oauth2/default"
                    required
                    className="h-10 font-mono text-sm tracking-tight"
                    disabled={submitting}
                  />
                </div>
              </div>
            </fieldset>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 gap-3 rounded-b-2xl sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-w-22 border-border/90"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !canSubmit}
              className="min-w-40 shadow-surface-xs"
            >
              {submitting ? 'Creating…' : 'Create organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
