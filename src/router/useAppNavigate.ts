import { useNavigate as useTanStackNavigate } from '@tanstack/react-router'
import type {
  FromPathOption,
  RegisteredRouter,
  UseNavigateResult,
} from '@tanstack/router-core'
import { patchPolicyKeyInOptions } from './policy-key-state'

/**
 * 复用 TanStack Router 的 useNavigate 签名，只在内部对参数做最小 patch。
 *
 * 当前支持：
 * - search: { policyKey }
 * - to: '/path?policyKey=xxx&other=yyy'
 * - state 合并保留
 */
export function useAppNavigate<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TDefaultFrom extends string = string,
>(_defaultOpts?: {
  from?: FromPathOption<TRouter, TDefaultFrom>
}): UseNavigateResult<TDefaultFrom> {
  const navigate = useTanStackNavigate<TRouter, TDefaultFrom>(_defaultOpts)

  const wrappedNavigate: UseNavigateResult<TDefaultFrom> = ((
    options: Parameters<typeof navigate>[0],
  ) => {
    const patched = patchPolicyKeyInOptions(options as Record<string, unknown>)
    return navigate(patched.options as Parameters<typeof navigate>[0])
  }) as UseNavigateResult<TDefaultFrom>

  return wrappedNavigate
}
