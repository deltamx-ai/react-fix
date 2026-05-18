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
- 通过 `hook + helper + cleaner + useAppNavigate` 可以把改动控制在比较小的范围内

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

统一改成：

```ts
const policyKey = usePolicyKey()
```

这是推荐的最终方式。

原因是：

1. `usePolicyKey()` 会优先从 `location.state` 读取
2. 仍兼容旧的 `search.policyKey`
3. 页面层以后不用再关心 policyKey 到底来自 search 还是 state

也就是说：

- **以前**：`useSearch()` 负责读 policyKey
- **现在**：`usePolicyKey()` 负责读 policyKey

而 `useSearch()` 只保留给非敏感参数，例如 `epmRefNo`、筛选条件、分页参数等。

这样你可以分批改，不需要一次性重构全项目。

### 第 3 步：统一导航入口

把所有：

```ts
navigate({
  to,
  search: { ...search, policyKey },
})
```

逐步改成下面两种方式之一。

#### 方式 A：显式 helper

```ts
navigateWithSensitiveState({
  navigate,
  to,
  search,
  sensitive: { policyKey },
})
```

#### 方式 B：统一替换 useNavigate（更适合大项目）

```ts
const navigate = useAppNavigate()

navigate({
  to,
  search: { ...search, policyKey },
})
```

现在这个 `useAppNavigate()` 已经改成**直接复用 TanStack Router 的原生类型签名**，不是自己再声明一套 `to/search/state` 类型。

而且它现在不只处理 `search.policyKey`，还会尽量处理这些入口：

1. `search: { policyKey }`
2. `to: '/path?policyKey=xxx'`
3. `to: '/path?policyKey=xxx&other=yyy'`
4. 原本已有 `state` 时做合并保留

这样 `useAppNavigate()` 会自动：

- 从 `search` 中拿出 `policyKey`
- 删除 `search.policyKey`
- 放到 `state.policyKey`
- 再调用 TanStack Router 原始 `useNavigate`

这招的好处是：业务代码的 `navigate({...})` 调用方式几乎不用改，只需要统一替换 import。

这样以后如果你们还有别的敏感字段，也能统一收口。

### 第 4 步：全局 import 替换策略

如果你的项目里现在大量是这样写的：

```ts
import { useNavigate } from '@tanstack/react-router'
```

建议逐步统一改成：

```ts
import { useAppNavigate as useNavigate } from '@/router'
```

或者：

```ts
import { useAppNavigate } from '@/router'
```

然后：

```ts
const navigate = useAppNavigate()
```

#### 为什么这个方式最省事

因为这样业务层大概率只需要改 import，不需要大面积改每个 `navigate()` 的调用参数。

也就是说，你原来写的是：

```ts
const navigate = useNavigate()

navigate({
  to: '/activity-detail',
  search: { epmRefNo, policyKey },
})
```

替换 import 后，很多地方甚至连下面的 `navigate({...})` 都不用动。

#### 推荐执行方式

1. 先新增 `src/router/useAppNavigate.ts`
2. 在 `src/router/index.ts` 导出它
3. 先人工改一两个页面验证
4. 再做全局替换 import
5. 最后再慢慢把关键页面改成显式 `navigateWithSensitiveState(...)`

#### 全局替换示例

如果你们项目已有统一别名 `@/router`，可以直接做一次机械替换：

查找：

```ts
import { useNavigate } from '@tanstack/react-router'
```

替换成：

```ts
import { useAppNavigate as useNavigate } from '@/router'
```

如果有些文件同时还从 `@tanstack/react-router` 引了别的东西，比如：

```ts
import { useNavigate, useSearch, Link } from '@tanstack/react-router'
```

那就拆成：

```ts
import { useSearch, Link } from '@tanstack/react-router'
import { useAppNavigate as useNavigate } from '@/router'
```

#### 批量替换脚本

这个模板里已经附了一个 **AST 版** 替换脚本：

```bash
node scripts/replace-use-navigate-imports.mjs <你的项目目录> <目标import路径>
```

比如：

```bash
node scripts/replace-use-navigate-imports.mjs ./src '@/router'
```

如果只是想先看哪些文件会改，不直接写回：

```bash
node scripts/replace-use-navigate-imports.mjs ./src '@/router' --dry-run
```

当前 package.json 里也提供了快捷命令：

```bash
npm run replace:navigate
npm run replace:navigate:dry
```

另外还有第二个 AST 脚本，用来处理 **policyKey 读取方式迁移**：

```bash
npm run replace:policykey-read
npm run replace:policykey-read:dry
```

它的目标不是替换 `useSearch()` 本身，而是把：

- `useSearch().policyKey`
- `Route.useSearch().policyKey`
- `const { policyKey } = useSearch(...)`

迁到：

```ts
const policyKey = usePolicyKey()
```

脚本会处理两种最常见情况：

1. 只有 `useNavigate`

```ts
import { useNavigate } from '@tanstack/react-router'
```

会改成：

```ts
import { useAppNavigate as useNavigate } from '@/router'
```

2. 混合 import

```ts
import { useNavigate, useSearch, Link } from '@tanstack/react-router'
```

会改成：

```ts
import { useSearch, Link } from '@tanstack/react-router'
import { useAppNavigate as useNavigate } from '@/router'
```

> 建议先在一个小目录或单独分支跑一遍，再看 diff 提交。

#### 落地建议

- **短期止血**：先挂 `SensitiveQueryCleaner`
- **低成本迁移**：全局把 `useNavigate` 切到 `useAppNavigate`
- **彻底收口**：逐步把敏感跳转改成显式 `navigateWithSensitiveState(...)`
- **统一读取**：所有读取都走 `usePolicyKey()`

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
    policy-key-state.ts
  types/
    router-shim.ts
  index.ts
```

---

## 你最应该先抄的 3 个文件

如果你现在要尽快改你自己的项目，优先抄这 3 个：

1. `src/router/policy-key-state.ts`
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

这个目录现在已经补了一个最小的 `package.json` / `tsconfig.json`，可以用于：

- 验证 `useAppNavigate` / `usePolicyKey` 的类型是否基本自洽
- 运行批量替换脚本

但它依然不是一个完整业务项目，没有真正的路由树、页面挂载和构建配置。

我这里没有你真实项目的依赖、路由定义和组件实现，所以代码尽量贴近 TanStack Router 写法，同时用注释说明应该替换成你项目里的：

- `useNavigate`
- `useRouterState`
- `useSearch`
- `Route.useSearch`

你可以把这些文件直接抄进现有项目，再按你们项目的实际 import 路径微调。

---

## FAQ：`useSearch()`、`usePolicyKey()` 和 `policy-key-state.ts`

### `policyKey` 以后是不是用 `usePolicyKey()` 代替 `useSearch()`？
是。

推荐做法是：

- `policyKey` → 统一走 `usePolicyKey()`
- `useSearch()` → 只保留给非敏感参数

例如：

```ts
const policyKey = usePolicyKey()
const search = useSearch({ strict: false })
const epmRefNo = search.epmRefNo
```

也就是说：

- **以前**：`useSearch().policyKey`
- **现在**：`usePolicyKey()`

这样页面层不用再关心 `policyKey` 究竟来自 `search` 还是 `state`。

### `policy-key-state.ts` 能不能删？
**不建议删。**

这个文件现在承担的是公共规则层，主要放：

- `POLICY_KEY` 常量
- `navigateWithSensitiveState()`
- `readSensitiveValueFromLocation()`
- `buildLocationAfterSensitiveMigration()`

可以这样理解职责分工：

- `usePolicyKey()`：负责读 `policyKey`
- `useAppNavigate()`：负责大多数跳转时自动迁移 `policyKey`
- `policy-key-state.ts`：负责公共规则和迁移逻辑
- `SensitiveQueryCleaner`：负责兜底清理旧 URL

所以它不是多余文件，而是这个方案的中间层。

如果你后面想换个更贴你们项目的名字，可以改名，但不建议直接删掉。

### `useAppNavigate()` 现在能覆盖哪些传参入口？

当前增强后，主要覆盖这些最常见的敏感参数传递方式：

#### 1. search 对象

```ts
navigate({
  to: '/manage-policy',
  search: { policyKey, epmRefNo },
})
```

会自动变成“`policyKey` 进 state，`epmRefNo` 留在 search”。

#### 2. to 字符串 query

```ts
navigate({
  to: `/manage-policy?policyKey=${policyKey}&epmRefNo=${epmRefNo}`,
})
```

会自动尽量处理成：

- `to: '/manage-policy'`
- `search: { epmRefNo }`
- `state: { policyKey }`

#### 3. 已有 state

如果原本已经传了：

```ts
state: { foo: 'bar' }
```

也会尽量保留并合并，不会直接覆盖掉。

### 目前还不建议完全指望自动处理的场景

下面这些还是建议人工检查：

- `search` 传的是 reducer / updater function
- `to` 是非常复杂的动态拼接
- 自定义 url builder / route map 先拼完整 URL 再传给 navigate
- 除了 `policyKey` 之外还有更多敏感字段需要统一抽离

如果你们后面不止 `policyKey` 一个敏感字段，可以把 `POLICY_KEY` 扩成数组策略，继续往这一层收口。
