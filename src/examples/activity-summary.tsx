import { navigateWithSensitiveState } from '../router/sensitive-route-state'
import type { NavigateFn, SearchRecord } from '../types/router-shim'

interface TxStatusOption {
  value: string
  label: string
}

interface NavigateToPathParams {
  txStatus: string
  txCode: string
  epmRefNo: string
  policyKey: string
  navigate: NavigateFn
  statusList: TxStatusOption[]
}

/**
 * 这是根据你截图里的 summary 页面用法改造出来的示例。
 *
 * 旧写法大概是：
 * navigate({
 *   from: '/activity-summary',
 *   to: '/activity-detail',
 *   search: { epmRefNo, policyKey },
 * })
 *
 * 新写法：policyKey 不再出现在 search 中。
 */
export function navigateToActivityDetail({
  txStatus,
  txCode,
  epmRefNo,
  policyKey,
  navigate,
  statusList,
}: NavigateToPathParams) {
  const value = statusList.find((item) => item.value === txCode)

  const search: SearchRecord = {
    epmRefNo,
    txCode,
    txStatus,
    txLabel: value?.label,
  }

  navigateWithSensitiveState({
    navigate,
    from: '/activity-summary',
    to: '/activity-detail',
    search,
    sensitive: {
      policyKey,
    },
  })
}

/**
 * 如果你们项目里还有 adNavigate(url, policyKey) 这种壳子，
 * 建议也统一把 policyKey 放进 state，而不是再去拼 query string。
 *
 * 比如可以改成：
 * adNavigate(url, { state: { policyKey } })
 *
 * 或者在 adNavigate 内部统一调用 history.pushState / router.navigate。
 */
