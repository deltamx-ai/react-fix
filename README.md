# react-fix：TanStack Router 敏感 query 迁移示例

这个目录是一个**参考模板**，演示如何把类似 `policyKey` 这种敏感值从 URL query/search 中迁走，改成放到 **TanStack Router 的 `location.state / history.state`** 里。

适合这种场景：

- 现在很多地方都在 `navigate({ search: { policyKey } })`
- 页面里很多地方都在 `Route.useSearch()` / `useSearch()` 里拿 `policyKey`
- 不希望敏感值出现在 URL 上
- 刷新页面后，希望当前 tab 尽量还能保留状态
- 不想用 `sessionStorage`
- 希望通过**统一封装**减少改动面

---

## 先说结论

### 推荐方案

把：

```ts
navigate({
  to: '/activity-detail',
  search: { epmRefNo, policyKey },
})
```

改成：

```ts
navigate({
  to: '/activity-detail',
  search: { epmRefNo },
  state: { policyKey },
})
```

然后页面里不要再直接从 `search.policyKey` 取，而是统一通过：

```ts
const policyKey = usePolicyKey()
```

这样：

- `policyKey` 不会出现在 URL 上
- 当前 tab 刷新时，浏览器通常还能保留 `history.state`
- 不需要 `sessionStorage`
- 通过 `hook + helper + cleaner` 可以把改动控制在比较小的范围内

---

## 最少改动策略

建议按下面顺序改。

### 第 1 步：先加公共清洗组件

先把 `src/components/SensitiveQueryCleaner.tsx` 挂到根 layout 或公共 layout。

作用：

- 如果旧代码还在往 URL 里塞 `policyKey`
- 页面一进来就自动把它搬到 `location.state`
- 然后立刻 `replace` 当前 URL，把 `policyKey` 从地址栏删掉

这一步可以**最快止血**。

> 注意：它只是过渡方案。因为请求进页面的那一瞬间，URL 里还是出现过敏感值。要彻底过审，还是要把所有源头 `navigate({ search: { policyKey }})` 改掉。

### 第 2 步：统一读取入口

把页面里所有直接读：

```ts
Route.useSearch().policyKey
// 或 useSearch().policyKey
```

逐步改成：

```ts
const policyKey = usePolicyKey()
```

这个 hook 会：

1. 优先从 `location.state` 读取
2. 兼容旧的 `search.policyKey`

这样你可以分批改，不需要一次性重构全项目。

### 第 3 步：统一导航入口

把所有：

```ts
navigate({
  to,
  search: { ...search, policyKey },
})
```

逐步改成：

```ts
navigateWithSensitiveState({
  navigate,
  to,
  search,
  sensitive: { policyKey },
})
```

这样以后如果你们还有别的敏感字段，也能统一收口。

---

## 目录说明

```txt
src/
  components/
    SensitiveQueryCleaner.tsx
  examples/
    activity-summary.tsx
    activity-detail.tsx
    location-modal.tsx
  hooks/
    usePolicyKey.ts
  router/
    sensitive-route-state.ts
  types/
    router-shim.ts
  index.ts
```

---

## 你最应该先抄的 3 个文件

如果你现在要尽快改你自己的项目，优先抄这 3 个：

1. `src/router/sensitive-route-state.ts`
2. `src/hooks/usePolicyKey.ts`
3. `src/components/SensitiveQueryCleaner.tsx`

然后：

- 在 app/layout 里挂 `SensitiveQueryCleaner`
- 把跳转统一改为 `state: { policyKey }`
- 把读取统一改为 `usePolicyKey()`

---

## 关于刷新保持状态

`location.state / history.state` 的特点：

- 同一个 tab 内刷新：**通常可保留**
- 前进/后退：**通常可保留**
- 新开 tab / 复制链接给别人：**不会带过去**

这其实正符合“敏感值不要通过 URL 传播”的目标。

---

## 如果安全要求更严格

更标准的企业方案其实是：

- URL 上只放一个**非敏感 ID**（比如 caseId / refId）
- 页面加载后由后端根据登录态返回详情
- 真实 `policyKey` 不经由 URL，也不落浏览器存储

但这个通常需要后端配合。

---

## 说明

这个目录是**参考模板**，不是完整运行项目。

我这里没有你真实项目的依赖、路由定义和组件实现，所以代码尽量贴近 TanStack Router 写法，同时用注释说明应该替换成你项目里的：

- `useNavigate`
- `useRouterState`
- `useSearch`
- `Route.useSearch`

你可以把这些文件直接抄进现有项目，再按你们项目的实际 import 路径微调。
