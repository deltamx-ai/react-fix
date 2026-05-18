import { useNavigate as useTanStackNavigate } from '@tanstack/react-router'
import { patchPolicyKeyInOptions } from './policy-key-state'

/**
 * 与 TanStack Router 原生 useNavigate 保持同签名。
 *
 * 目标：
 * - 调用侧尽量 0 类型心智成本
 * - 内部只做 runtime patch，不额外改变泛型推导
 */
export const useAppNavigate: typeof useTanStackNavigate = ((defaultOpts?: unknown) => {
  const navigate = useTanStackNavigate(defaultOpts as never)

  return ((options: unknown) => {
    const patched = patchPolicyKeyInOptions(
      options as Record<string, unknown> & {
        to?: unknown
        search?: unknown
        state?: unknown
      },
    )

    return navigate(patched.options as never)
  }) as never
}) as typeof useTanStackNavigate
