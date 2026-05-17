import { useMemo } from 'react'
import { POLICY_KEY, readSensitiveValueFromLocation } from '../router/sensitive-route-state'
import type { RouterLocationLike } from '../types/router-shim'

/**
 * 这是一个纯函数版本，便于在非 React 场景或单测里直接复用。
 */
export function getPolicyKeyFromLocation(location: RouterLocationLike): string {
  return readSensitiveValueFromLocation<string>(location, POLICY_KEY) ?? ''
}

/**
 * 真正落到你们项目时，可以替换成：
 *
 * const location = useRouterState({ select: (s) => s.location })
 *
 * 或者：
 * const search = Route.useSearch()
 * const locationState = useRouterState({ select: (s) => s.location.state })
 *
 * 这里保留成参数形式，是为了让示例更独立、更好抄。
 */
export function usePolicyKey(location: RouterLocationLike): string {
  return useMemo(() => getPolicyKeyFromLocation(location), [location])
}

/**
 * 你在真实项目中可以直接做一个无参 hook：
 *
 * export function usePolicyKey() {
 *   const location = useRouterState({ select: (s) => s.location })
 *   return readSensitiveValueFromLocation<string>(location, POLICY_KEY) ?? ''
 * }
 */
