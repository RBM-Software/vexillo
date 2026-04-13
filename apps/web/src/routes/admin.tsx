import { Outlet, useRouterState } from '@tanstack/react-router'

import { AdminSidebar } from '@/components/admin-sidebar'
import { ModeToggle } from '@/components/mode-toggle'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

function adminPageTitle(pathname: string): string {
  if (pathname === '/admin/users' || pathname.startsWith('/admin/users')) {
    return 'Administrators'
  }
  if (/^\/admin\/orgs\/[^/]+$/.test(pathname)) {
    return 'Organization'
  }
  return 'Organizations'
}

export function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const title = adminPageTitle(pathname)

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset className="min-h-dvh min-w-0">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm supports-backdrop-filter:bg-background/80 sm:px-6">
          <SidebarTrigger className="-ms-1" />
          <div
            className="min-w-0 flex-1 truncate font-heading text-[0.9375rem] font-medium tracking-[-0.015em] text-foreground sm:text-base"
            title={title}
          >
            {title}
          </div>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex shrink-0 items-center gap-2">
            <ModeToggle />
          </div>
        </header>
        <main
          id="main-content"
          className="main-canvas relative flex min-h-0 min-w-0 flex-1 flex-col bg-muted/35 dark:bg-muted/10"
        >
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
