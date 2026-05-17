import { useAppNavigate as useNavigate } from '@/router'

export function A() {
  const navigate = useNavigate()
  return <button onClick={() => navigate({ to: '/a', search: { policyKey: 'P1' } })}>go</button>
}
