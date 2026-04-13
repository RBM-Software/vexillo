import { Link, useRouterState } from '@tanstack/react-router'
import { ArrowLeft, Building2, Flag, Shield } from 'lucide-react'

import { SignOutButton } from '@/components/sign-out-button'
import { authClient } from '@/lib/auth-client'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const NAV_ITEMS = [
  {
    label: 'Organizations',
    to: '/admin' as const,
    matchPrefix: '/admin/orgs',
    icon: Building2,
  },
  {
    label: 'Administrators',
    to: '/admin/users' as const,
    matchPrefix: '/admin/users',
    icon: Shield,
  },
] as const

function navIsActive(pathname: string, to: string, matchPrefix: string) {
  if (to === '/admin') {
    return pathname === '/admin' || pathname.startsWith(matchPrefix)
  }
  return pathname === to || pathname.startsWith(matchPrefix)
}

export function AdminSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { data: session } = authClient.useSession()
  const email = session?.user?.email

  return (
    <Sidebar collapsible="offcanvas" className="bg-sidebar">
      <SidebarHeader className="gap-0 border-b border-sidebar-border px-4 py-5">
        <Link
          to="/admin"
          className="block rounded-sm outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
              <Flag className="h-4 w-4 text-sidebar-foreground" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block font-heading text-lg font-medium tracking-[-0.02em] text-sidebar-foreground">
                Vexillo
              </span>
              <span className="mt-0.5 block text-[0.65rem] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/55">
                Platform
              </span>
            </span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-3 pt-4">
        <SidebarGroup className="px-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const active = navIsActive(pathname, item.to, item.matchPrefix)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={active}
                      className="px-3 py-2.5"
                      render={<Link to={item.to} />}
                    >
                      <Icon className="opacity-80" />
                      <span className="font-medium">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <Link
          to="/"
          className="mb-4 flex items-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground/85 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 opacity-80" />
          Workspace
        </Link>
        {email && (
          <p
            className="mb-3 truncate text-xs leading-snug text-sidebar-foreground/80"
            title={email}
          >
            {email}
          </p>
        )}
        <SignOutButton
          variant="outline"
          size="sm"
          className="w-full justify-center border-sidebar-border bg-sidebar-accent/35 text-sidebar-foreground shadow-surface-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:bg-sidebar-accent/25"
        />
      </SidebarFooter>
    </Sidebar>
  )
}
