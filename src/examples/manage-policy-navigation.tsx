import { navigateWithSensitiveState } from '../router/policy-key-state'
import type { NavigateFn, SearchRecord } from '../types/router-shim'

interface MenuActionParams {
  type: 'create' | 'edit' | 'modify' | 'del'
  epmRefNo: string
  policyKey: string
  policyTypeRoute?: string
  navigate: NavigateFn
}

/**
 * 这是根据你第二张图里的 menuAction 改造出来的示例。
 */
export function menuActionNavigate({
  type,
  epmRefNo,
  policyKey,
  policyTypeRoute,
  navigate,
}: MenuActionParams) {
  const search: SearchRecord = {
    epmRefNo,
  }

  if (type === 'create') {
    navigateWithSensitiveState({
      navigate,
      to: '/manage-policy',
      search,
      sensitive: { policyKey },
    })
    return
  }

  if (type === 'edit' || type === 'modify') {
    navigateWithSensitiveState({
      navigate,
      to: policyTypeRoute || '/manage-policy/edit',
      search,
      sensitive: { policyKey },
    })
  }
}
