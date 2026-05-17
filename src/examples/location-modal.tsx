import { navigateWithSensitiveState } from '../router/sensitive-route-state'
import type { NavigateFn } from '../types/router-shim'

interface LocationModalProps {
  policyKey?: string
  stayOnCurrentPage?: boolean
  navigate: NavigateFn
}

/**
 * 这是根据你截图里的 LocationModal 改造出来的示例。
 *
 * 旧写法：
 * if (policyKey) {
 *   navigate({ to: '/manage-policy', search: { policyKey } })
 * }
 *
 * 新写法：
 * if (policyKey) {
 *   navigate({ to: '/manage-policy', state: { policyKey } })
 * }
 */
export function onLocationModalConfirm({
  policyKey,
  stayOnCurrentPage,
  navigate,
}: LocationModalProps) {
  if (stayOnCurrentPage) {
    return
  }

  if (policyKey) {
    navigateWithSensitiveState({
      navigate,
      to: '/manage-policy',
      sensitive: { policyKey },
    })
    return
  }

  navigate({
    to: '/activity-summary',
  })
}
