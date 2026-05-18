import { useRouterState } from '@tanstack/react-router'
import {
  POLICY_KEY,
  readSensitiveValueFromLocation,
  type RouterLocationLike,
} from '../router/policy-key-state'

/**
 * 纯函数版本，便于单测或非 React 场景复用。
 */
export function getPolicyKeyFromLocation(location: RouterLocationLike): string {
  return readSensitiveValueFromLocation<string>(location, POLICY_KEY) ?? ''
}

/**
 * 真实项目可直接使用的无参 hook。
 *
 * 行为：
 * - 优先读 location.state.policyKey
 * - 兼容旧的 location.search.policyKey
 */
export function usePolicyKey(): string {
  const location = useRouterState({
    select: (state) => state.location,
  })

  return getPolicyKeyFromLocation(location as unknown as RouterLocationLike)
}
