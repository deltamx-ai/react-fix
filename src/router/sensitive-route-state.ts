import type {
  NavigateWithSensitiveStateOptions,
  RouterLocationLike,
  SearchRecord,
  SensitiveState,
} from '../types/router-shim'

/**
 * 统一管理敏感 route state 的 key。
 * 后面如果还有 customerNo / proposalNo / accountNo 之类，也可以继续往这里收。
 */
export const SENSITIVE_ROUTE_KEYS = {
  policyKey: 'policyKey',
} as const

export const POLICY_KEY = SENSITIVE_ROUTE_KEYS.policyKey

export function getSensitiveStateValue<T = string>(
  state: SensitiveState | undefined,
  key: string,
): T | undefined {
  return state?.[key] as T | undefined
}

export function omitSensitiveKeysFromSearch(
  search: SearchRecord | undefined,
  keys: string[] = [POLICY_KEY],
): SearchRecord | undefined {
  if (!search) return search

  const nextSearch = { ...search }

  for (const key of keys) {
    delete nextSearch[key]
  }

  return nextSearch
}

/**
 * 统一导航入口：
 * - 正常 search 保留
 * - 敏感值放到 state
 * - 自动避免把敏感值继续挂在 search 上
 */
export function navigateWithSensitiveState({
  navigate,
  to,
  from,
  search,
  replace,
  sensitive,
}: NavigateWithSensitiveStateOptions) {
  const nextSearch = omitSensitiveKeysFromSearch(search)

  navigate({
    to,
    from,
    search: nextSearch,
    replace,
    state: {
      ...sensitive,
    },
  })
}

/**
 * 从 location 中读取敏感值，优先 state，兼容旧 search。
 * 这样可以支持渐进迁移。
 */
export function readSensitiveValueFromLocation<T = string>(
  location: RouterLocationLike,
  key: string,
): T | undefined {
  const fromState = location.state?.[key] as T | undefined
  if (fromState !== undefined && fromState !== null && fromState !== '') {
    return fromState
  }

  return location.search?.[key] as T | undefined
}

/**
 * 判断当前 URL 上是否还残留敏感 query。
 */
export function hasSensitiveQuery(
  search: SearchRecord | undefined,
  key: string = POLICY_KEY,
): boolean {
  if (!search) return false
  return Boolean(search[key])
}

/**
 * 把 query 中的敏感值迁到 state。
 * 常用于 cleaner 组件中。
 */
export function buildLocationAfterSensitiveMigration(
  location: RouterLocationLike,
  key: string = POLICY_KEY,
): RouterLocationLike | null {
  const value = location.search?.[key]

  if (!value) {
    return null
  }

  const nextSearch = omitSensitiveKeysFromSearch(location.search, [key])

  return {
    pathname: location.pathname,
    search: nextSearch,
    state: {
      ...(location.state ?? {}),
      [key]: value,
    },
  }
}
