import { useEffect } from 'react'
import {
  buildLocationAfterSensitiveMigration,
  POLICY_KEY,
} from '../router/sensitive-route-state'
import type { NavigateFn, RouterLocationLike } from '../types/router-shim'

interface SensitiveQueryCleanerProps {
  location: RouterLocationLike
  navigate: NavigateFn
}

/**
 * 用法：
 *
 * 把它挂到根 layout / 公共 layout。
 * 如果旧代码还在把 policyKey 放进 search，这个组件会：
 * 1. 读出 search.policyKey
 * 2. 搬到 location.state
 * 3. replace 当前 URL，删掉地址栏里的 policyKey
 *
 * 真实项目里可替换为：
 * - useNavigate()
 * - useRouterState({ select: (s) => s.location })
 */
export function SensitiveQueryCleaner({
  location,
  navigate,
}: SensitiveQueryCleanerProps) {
  useEffect(() => {
    const nextLocation = buildLocationAfterSensitiveMigration(location, POLICY_KEY)

    if (!nextLocation) return

    navigate({
      to: nextLocation.pathname,
      search: nextLocation.search,
      state: nextLocation.state,
      replace: true,
    })
  }, [location, navigate])

  return null
}
