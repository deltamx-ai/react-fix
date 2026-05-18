import { useSearch } from '@tanstack/react-router'
import { usePolicyKey } from '@/hooks/usePolicyKey';

export function PolicyReadA() {
  const { epmRefNo } = useSearch({ strict: false })
  const policyKey = usePolicyKey()
  return <div>{policyKey}-{epmRefNo}</div>
}
