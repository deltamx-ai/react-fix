import { usePolicyKey } from '../hooks/usePolicyKey'
import type { RouterLocationLike } from '../types/router-shim'

interface ActivityDetailProps {
  location: RouterLocationLike
}

/**
 * 详情页示例。
 *
 * 旧写法通常是：
 * const { epmRefNo, policyKey } = Route.useSearch()
 *
 * 改造后：
 * - 非敏感字段继续从 search 取，比如 epmRefNo
 * - policyKey 改成统一从 usePolicyKey() 取
 */
export function ActivityDetail({ location }: ActivityDetailProps) {
  const policyKey = usePolicyKey(location)
  const epmRefNo = String(location.search?.epmRefNo ?? '')

  return (
    <section>
      <h2>Activity Detail</h2>
      <div>epmRefNo: {epmRefNo}</div>
      <div>policyKey: {policyKey ? '已从 state/兼容 search 读取' : '未找到'}</div>
    </section>
  )
}
