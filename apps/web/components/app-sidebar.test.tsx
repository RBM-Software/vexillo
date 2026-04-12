/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AppSidebar } from './app-sidebar'

const mockOrg = { id: '1', name: 'Acme', slug: 'acme', status: 'active' as const }

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, params }: { to: string; children?: React.ReactNode; params?: Record<string, string> }) => (
    <a href={params ? to.replace(/\$(\w+)/g, (_, k) => params[k] ?? '') : to}>{children}</a>
  ),
  useRouterState: () => ({ location: { pathname: '/org/acme/flags' } }),
}))

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  SidebarMenuButton: ({ children, render: renderProp }: { children: React.ReactNode; render?: { props: { to?: string } }; isActive?: boolean; className?: string }) => {
    if (renderProp) {
      return <a href={renderProp.props.to ?? '#'}>{children}</a>
    }
    return <button>{children}</button>
  },
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
}))

vi.mock('@/components/sign-out-button', () => ({
  SignOutButton: () => <button>Sign out</button>,
}))

describe('AppSidebar', () => {
  it('does not show Admin link when isSuperAdmin is false', () => {
    render(
      <AppSidebar org={mockOrg} role="viewer" userEmail="user@example.com" isSuperAdmin={false} />
    )
    expect(screen.queryByText('Admin')).toBeNull()
  })

  it('does not show Admin link when isSuperAdmin is omitted', () => {
    render(
      <AppSidebar org={mockOrg} role="viewer" userEmail="user@example.com" />
    )
    expect(screen.queryByText('Admin')).toBeNull()
  })

  it('shows Admin link linking to /admin when isSuperAdmin is true', () => {
    render(
      <AppSidebar org={mockOrg} role="viewer" userEmail="user@example.com" isSuperAdmin={true} />
    )
    const link = screen.getByRole('link', { name: /admin/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/admin')
  })
})
