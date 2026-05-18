export type SearchRecord = Record<string, unknown>
export type SensitiveState = Record<string, unknown>

/**
 * 只给 examples/demo 用。
 * 核心实现已经尽量改成直接复用 TanStack Router 类型，不再依赖这里。
 */
export interface NavigateFn {
  (options: {
    to: string
    from?: string
    search?: SearchRecord
    replace?: boolean
    state?: SensitiveState
  }): void
}
