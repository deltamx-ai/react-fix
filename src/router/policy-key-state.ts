import type { ParsedLocation } from '@tanstack/react-router'

/**
 * demo / 文档层的轻量 location 结构。
 * 真正接 TanStack Router 时，也可以直接传 ParsedLocation。
 */
export interface RouterLocationLike {
  pathname: string
  search?: Record<string, unknown>
  state?: Record<string, unknown>
}

export type CompatibleLocation = RouterLocationLike | ParsedLocation

/**
 * 统一管理敏感 route state 的 key。
 * 后面如果还有 customerNo / proposalNo / accountNo 之类，也可以继续往这里收。
 */
export const SENSITIVE_ROUTE_KEYS = {
  policyKey: 'policyKey',
} as const

export const POLICY_KEY = SENSITIVE_ROUTE_KEYS.policyKey

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getSensitiveStateValue<T = string>(
  state: Record<string, unknown> | undefined,
  key: string,
): T | undefined {
  return state?.[key] as T | undefined
}

export function omitSensitiveKeysFromSearch(
  search: Record<string, unknown> | undefined,
  keys: string[] = [POLICY_KEY],
): Record<string, unknown> | undefined {
  if (!isPlainObject(search)) return search

  const nextSearch = { ...search }

  for (const key of keys) {
    delete nextSearch[key]
  }

  return nextSearch
}

export function parseQueryString(searchText: string): Record<string, string> {
  const params = new URLSearchParams(searchText)
  const result: Record<string, string> = {}

  for (const [key, value] of params.entries()) {
    result[key] = value
  }

  return result
}

export function stringifyQueryObject(search: Record<string, unknown> | undefined): string {
  if (!isPlainObject(search)) return ''

  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

export function splitPathAndQuery(to: string): {
  pathname: string
  search: Record<string, string>
  hash: string
} {
  const hashIndex = to.indexOf('#')
  const hash = hashIndex >= 0 ? to.slice(hashIndex) : ''
  const withoutHash = hashIndex >= 0 ? to.slice(0, hashIndex) : to
  const queryIndex = withoutHash.indexOf('?')

  if (queryIndex < 0) {
    return {
      pathname: withoutHash,
      search: {},
      hash,
    }
  }

  return {
    pathname: withoutHash.slice(0, queryIndex),
    search: parseQueryString(withoutHash.slice(queryIndex + 1)),
    hash,
  }
}

type PolicyKeyNavigableOptions = Record<string, unknown> & {
  to?: unknown
  search?: unknown
  state?: unknown
}

export interface PolicyKeyPatchedOptions<TOptions extends PolicyKeyNavigableOptions> {
  options: TOptions
  policyKey?: unknown
}

/**
 * 统一 patch：
 * 1. search 对象里的 policyKey → state
 * 2. to 字符串 query 里的 policyKey → state
 * 3. 其他非敏感 query 继续保留在 search / to 中
 */
export function patchPolicyKeyInOptions<TOptions extends PolicyKeyNavigableOptions>(
  options: TOptions,
): PolicyKeyPatchedOptions<TOptions> {
  const nextOptions = { ...options }
  const rawState = isPlainObject(options.state) ? options.state : {}
  const nextState: Record<string, unknown> = { ...rawState }
  let extractedPolicyKey: unknown

  const rawSearch = options.search
  if (isPlainObject(rawSearch) && POLICY_KEY in rawSearch) {
    extractedPolicyKey = rawSearch[POLICY_KEY]
    nextOptions.search = omitSensitiveKeysFromSearch(rawSearch) as TOptions['search']
  }

  const rawTo = options.to
  if (typeof rawTo === 'string' && rawTo.includes(`${POLICY_KEY}=`)) {
    const { pathname, search, hash } = splitPathAndQuery(rawTo)

    if (search[POLICY_KEY] !== undefined && extractedPolicyKey === undefined) {
      extractedPolicyKey = search[POLICY_KEY]
    }

    const mergedSearch = {
      ...(isPlainObject(nextOptions.search) ? (nextOptions.search as Record<string, unknown>) : {}),
      ...omitSensitiveKeysFromSearch(search),
    }

    nextOptions.to = `${pathname}${hash}` as TOptions['to']
    nextOptions.search = mergedSearch as TOptions['search']
  }

  if (extractedPolicyKey !== undefined && extractedPolicyKey !== null && extractedPolicyKey !== '') {
    nextState[POLICY_KEY] = extractedPolicyKey
    nextOptions.state = nextState as TOptions['state']
  }

  return {
    options: nextOptions,
    policyKey: extractedPolicyKey,
  }
}

/**
 * 统一导航入口：
 * - 正常 search 保留
 * - 敏感值放到 state
 * - 自动避免把敏感值继续挂在 search 或 to query 上
 *
 * 重点：不自己声明 navigate 的 options 类型，而是直接复用传入 navigate 的参数类型。
 */
export function navigateWithSensitiveState<
  TNavigate extends (options: any) => any,
>(params: {
  navigate: TNavigate
  sensitive?: Record<string, unknown>
} & Parameters<TNavigate>[0]) {
  const { navigate, sensitive, ...options } = params
  const optionBag = options as Record<string, unknown>
  const patched = patchPolicyKeyInOptions(optionBag)

  return navigate({
    ...patched.options,
    state: {
      ...(isPlainObject(patched.options.state) ? patched.options.state : {}),
      ...(sensitive ?? {}),
    },
  } as Parameters<TNavigate>[0])
}

/**
 * 从 location 中读取敏感值，优先 state，兼容旧 search。
 * 这样可以支持渐进迁移。
 */
export function readSensitiveValueFromLocation<T = string>(
  location: CompatibleLocation,
  key: string,
): T | undefined {
  const state = isPlainObject(location.state)
    ? location.state
    : (location.state as Record<string, unknown> | undefined)
  const search = isPlainObject(location.search)
    ? location.search
    : (location.search as Record<string, unknown> | undefined)

  const fromState = state?.[key] as T | undefined
  if (fromState !== undefined && fromState !== null && fromState !== '') {
    return fromState
  }

  return search?.[key] as T | undefined
}

/**
 * 判断当前 URL 上是否还残留敏感 query。
 */
export function hasSensitiveQuery(
  search: Record<string, unknown> | undefined,
  key: string = POLICY_KEY,
): boolean {
  if (!isPlainObject(search)) return false
  return Boolean(search[key])
}

/**
 * 把 query 中的敏感值迁到 state。
 * 常用于 cleaner 组件中。
 */
export function buildLocationAfterSensitiveMigration(
  location: CompatibleLocation,
  key: string = POLICY_KEY,
): RouterLocationLike | null {
  const search = isPlainObject(location.search)
    ? location.search
    : (location.search as Record<string, unknown> | undefined)
  const state = isPlainObject(location.state)
    ? location.state
    : (location.state as Record<string, unknown> | undefined)
  const value = search?.[key]

  if (!value) {
    return null
  }

  const nextSearch = omitSensitiveKeysFromSearch(search, [key])

  return {
    pathname: location.pathname,
    search: nextSearch,
    state: {
      ...(state ?? {}),
      [key]: value,
    },
  }
}
