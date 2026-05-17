import { useNavigate as useTanStackNavigate } from '@tanstack/react-router'
import { omitSensitiveKeysFromSearch, POLICY_KEY } from './sensitive-route-state'
import type { SearchRecord, SensitiveState } from '../types/router-shim'

interface UseAppNavigateOptions {
  to: string
  from?: string
  search?: SearchRecord
  replace?: boolean
  state?: SensitiveState
}

/**
 * 对 useNavigate 的轻量封装。
 *
 * 目标：
 * - 尽量少改业务调用方式
 * - 如果 search 里出现 policyKey，自动转移到 state
 * - 让老代码从“显式传 search.policyKey”平滑过渡
 *
 * 用法：
 * const navigate = useAppNavigate()
 * navigate({ to: '/manage-policy', search: { policyKey, epmRefNo } })
 */
export function useAppNavigate() {
  const navigate = useTanStackNavigate()

  return (options: UseAppNavigateOptions) => {
    const rawSearch = options.search
    const nextSearch = omitSensitiveKeysFromSearch(rawSearch)
    const nextState: SensitiveState = {
      ...(options.state ?? {}),
    }

    const policyKey = rawSearch?.[POLICY_KEY]

    if (policyKey !== undefined && policyKey !== null && policyKey !== '') {
      nextState[POLICY_KEY] = policyKey
    }

    return navigate({
      ...options,
      search: nextSearch,
      state: nextState,
    })
  }
}
