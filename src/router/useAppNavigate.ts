import { useCallback } from 'react'
import { useNavigate as useTanStackNavigate } from '@tanstack/react-router'
import type {
  FromPathOption,
  RegisteredRouter,
  UseNavigateResult,
} from '@tanstack/router-core'
import { POLICY_KEY } from './sensitive-route-state'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 仅在运行时 patch plain object 形式的 search/state：
 * - 如果 search 里出现 policyKey，则把它移到 state
 * - 如果 search 不是普通对象（例如 reducer / true / 其他形式），则原样透传
 *
 * 这样可以尽量复用 TanStack Router 的原生类型，避免自定义 navigate 类型
 * 与真实路由泛型冲突。
 */
function patchSensitiveState<TOptions extends Record<string, unknown>>(
  options: TOptions,
): TOptions {
  const rawSearch = options.search

  if (!isPlainObject(rawSearch)) {
    return options
  }

  const policyKey = rawSearch[POLICY_KEY]

  if (policyKey === undefined || policyKey === null || policyKey === '') {
    return options
  }

  const nextSearch = { ...rawSearch }
  delete nextSearch[POLICY_KEY]

  const rawState = options.state
  const nextState = isPlainObject(rawState) ? { ...rawState } : {}
  nextState[POLICY_KEY] = policyKey

  return {
    ...options,
    search: nextSearch,
    state: nextState,
  }
}

/**
 * 复用 TanStack Router 的 useNavigate 签名，只在内部对参数做最小 patch。
 *
 * 用法：
 * const navigate = useAppNavigate()
 * navigate({ to: '/manage-policy', search: { policyKey, epmRefNo } })
 */
export function useAppNavigate<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TDefaultFrom extends string = string,
>(_defaultOpts?: {
  from?: FromPathOption<TRouter, TDefaultFrom>
}): UseNavigateResult<TDefaultFrom> {
  const navigate = useTanStackNavigate<TRouter, TDefaultFrom>(_defaultOpts)

  return useCallback(
    ((options: Parameters<typeof navigate>[0]) => {
      return navigate(
        patchSensitiveState(options as Record<string, unknown>) as Parameters<
          typeof navigate
        >[0],
      )
    }) as UseNavigateResult<TDefaultFrom>,
    [navigate],
  )
}
