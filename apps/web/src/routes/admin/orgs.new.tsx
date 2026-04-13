import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'

/** Legacy URL: opens the create flow on the organizations page. */
export function AdminOrgsNewPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate({ to: '/admin', search: { newOrg: '1' }, replace: true })
  }, [navigate])

  return null
}
