import { useNavigate as useTanStackNavigate } from '@tanstack/react-router'
import type {
  AnyRouter,
  FromPathOption,
  RegisteredRouter,
} from '@tanstack/router-core'
import { patchPolicyKeyInOptions } from './policy-key-state'

/**
 * 尽量保留 TanStack Router 原始 navigate 的精确参数类型。
 *
 * 关键点：
 * - hook 参数继续沿用原始 from 泛型
 * - 返回值直接复用当前 `navigate` 实例的类型（`typeof navigate`）
 * - 内部只做 runtime patch
 */
export function useAppNavigate<
  TRouter extends AnyRouter = RegisteredRouter,
  TDefaultFrom extends string = string,
>(_defaultOpts?: {
  from?: FromPathOption<TRouter, TDefaultFrom>
}) {
  const navigate = useTanStackNavigate<TRouter, TDefaultFrom>(_defaultOpts)

  return ((options: Parameters<typeof navigate>[0]) => {
    const patched = patchPolicyKeyInOptions(
      options as Record<string, unknown> & {
        to?: unknown
        search?: unknown
        state?: unknown
      },
    )

    return navigate(patched.options as Parameters<typeof navigate>[0])
  }) as typeof navigate
}
