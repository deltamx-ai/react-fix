import { usePolicyKey } from '@/hooks/usePolicyKey';

export function PolicyReadB() {
  const policyKey = usePolicyKey()
  return <div>{policyKey}</div>
}
