# CSP 配置风险整改说明

## 一、问题概述

本次安全扫描发现，目标系统响应头中的 `Content-Security-Policy`（CSP）配置存在不安全指令，主要表现为：

- 使用了 `'unsafe-inline'`
- 使用了 `'unsafe-eval'`

对应报告信息如下：

- **Risk Level**: Low
- **CVSS 3.1**: 3.5
- **Vector**: `CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:U/C:L/I:N/A:N`
- **Issue Status**: Open
- **OWASP Top 10**: A05 Security Misconfiguration
- **Affected Component**: `https://api.hkuat.manulife.com.hk/ext/hk-ado-portal-function-service-env2/ebs/aws_main.jsp?action=quotation_aw054_04_save&agent_type=AGENT`
- **Affected Service**: Change Payment Mode service

---

## 二、风险说明

CSP 是浏览器侧的一层安全控制，主要用于限制页面可以加载哪些脚本、样式、图片、接口域名，以及是否允许执行内联脚本、动态求值等高风险行为。

当前问题在于 CSP 中包含以下不安全配置：

### 1. `unsafe-inline`
允许执行：

- 页面内联 `<script>`
- 内联事件处理器，如 `onclick="..."`
- 某些内联样式/脚本逻辑

风险：

- 会削弱 CSP 对 XSS 的防护效果
- 一旦页面中存在注入点，攻击者更容易执行恶意脚本

### 2. `unsafe-eval`
允许执行：

- `eval()`
- `new Function()`
- 字符串形式的 `setTimeout()` / `setInterval()`

风险：

- 允许浏览器执行动态拼接的字符串代码
- 如果攻击者能够控制输入内容，可能导致任意脚本执行

---

## 三、问题本质

该问题属于 **安全配置不当（Security Misconfiguration）**，重点不在于某一个 React 组件本身，而在于：

- 响应头策略过宽
- 浏览器未被严格限制加载和执行资源
- CSP 没有形成有效白名单保护

这类问题通常出现在以下层面之一：

- Nginx / Ingress / API Gateway
- Java Filter / Servlet Filter
- Spring Security Header 配置
- JSP 公共模板
- 门户外壳页 / 容器页统一响应头

由于受影响地址为 `aws_main.jsp`，初步判断更可能是：

- **服务端 JSP 页或统一网关层 CSP 配置问题**
- 不一定是 React 业务代码直接生成了该风险

---

## 四、整改目标

整改目标是将 CSP 从“宽松放行”调整为“按需白名单 + 禁止高风险执行方式”。

### 目标原则

1. 去掉 `unsafe-inline`
2. 去掉 `unsafe-eval`
3. 为脚本、样式、接口、图片等资源声明明确来源
4. 补充缺失的关键指令
5. 尽量在统一配置层修复，减少对业务代码的分散改动

---

## 五、推荐整改方案

### 方案 1：优先移除 `unsafe-eval`

这是相对容易优先落地的一步。

#### 排查内容
全局搜索以下高风险模式：

```js
eval(
new Function(
setTimeout("...")
setInterval("...")
```

#### 常见来源

- 老旧前端代码直接调用 `eval`
- 某些第三方库使用字符串求值
- 打包配置在生产环境误用了 `eval` 类 source map

#### 处理建议

- 用正常函数替代 `eval` / `new Function`
- 避免在生产构建中使用 `eval` 相关 source map
- 检查构建配置，生产环境不要使用类似：

```js
devtool: 'eval'
```

可改为：

```js
devtool: false
```

或使用非 `eval` 方案。

---

### 方案 2：移除 `unsafe-inline`

这一步通常改动相对更大，但属于 CSP 真正收紧的关键步骤。

#### 重点排查
搜索以下内容：

```html
onclick=
onchange=
onload=
onerror=
<script>
```

#### 典型问题写法

```html
<button onclick="saveQuote()">Save</button>
```

#### 推荐改法

```html
<button id="save-btn">Save</button>
<script src="/static/change-payment-mode.js"></script>
```

```js
document.getElementById('save-btn')?.addEventListener('click', saveQuote)
```

#### 整改原则

- 移除页面内联脚本
- 移除 HTML 内联事件处理器
- 将脚本逻辑迁移到外部 JS 文件
- 使用事件绑定替代 `onclick="..."`

---

### 方案 3：如短期无法彻底移除内联脚本，可用 nonce 过渡

如果现阶段 JSP 页面或门户壳层仍依赖少量内联脚本，可以采用 nonce 方案过渡，而不是继续使用 `unsafe-inline`。

#### 示例

响应头：

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-rAnd0m123';
  style-src 'self' 'nonce-rAnd0m123';
  object-src 'none';
```

页面：

```html
<script nonce="rAnd0m123">
  initPage();
</script>
```

#### 注意事项

- nonce 必须每次响应动态生成
- 前后端模板必须配合注入 nonce
- nonce 是过渡方案，不建议长期滥用

---

### 方案 4：按实际依赖收紧 CSP 白名单

建议按业务真实依赖收紧以下指令：

- `script-src`
- `style-src`
- `connect-src`
- `img-src`
- `font-src`
- `frame-ancestors`
- `base-uri`
- `object-src`
- `form-action`

#### 推荐基线模板

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self';
  img-src 'self' data: https:;
  font-src 'self' https:;
  connect-src 'self' https://api.hkuat.manulife.com.hk;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'self';
  form-action 'self';
```

说明：

- 如业务确实依赖特定 CDN、静态资源域名、第三方接口域名，应按需显式加入
- 不建议使用 `*`、`blob:`、宽泛 `data:`，除非业务确有需要且已评估风险

---

## 六、最小改动落地顺序

建议按以下顺序推进，风险最低：

### 第一步：确认 CSP 配置来源
先确认响应头到底在哪一层设置：

- 网关 / Nginx / Ingress
- 后端应用配置
- JSP 公共模板
- 安全中间件

如果是统一层设置，优先改统一层，收益最大。

### 第二步：优先去掉 `unsafe-eval`
这一步通常改动最小，收益明确。

### 第三步：排查并清理内联脚本 / 内联事件
重点是：

- `<script>...</script>`
- `onclick="..."`
- `onchange="..."`
- `onload="..."`

### 第四步：必要时用 nonce 过渡
如果短期无法完全改造，可先用 nonce 替代 `unsafe-inline`。

### 第五步：收紧白名单
根据实际域名依赖精确限制资源来源。

---

## 七、整改收益

修复后可以带来的收益：

- 降低 XSS 攻击成功率
- 降低内联脚本注入被执行的风险
- 降低动态字符串求值带来的代码执行风险
- 满足安全扫描对 CSP 配置的基本要求
- 提升浏览器端安全基线

---

## 八、边界说明

需要注意，CSP 不是替代输入校验或后端权限控制的万能方案。

即使 CSP 修复完成，仍然需要配合：

- 输入校验
- 输出转义
- 模板渲染安全
- 权限控制
- 接口鉴权

CSP 的价值在于：**作为浏览器侧最后一道资源执行限制，减少漏洞被利用后的破坏面。**

---

## 九、建议结论

本问题建议按“统一配置优先、先去 `unsafe-eval`、再收敛 `unsafe-inline`、必要时 nonce 过渡、最终白名单化”路线整改。

如果当前 CSP 是由统一网关或 JSP 公共层注入，则优先在统一层整改，可以以最小改动覆盖多个页面与服务。

对于本次 "Change Payment Mode" 服务，可先从以下动作开始：

1. 确认 CSP 头的注入位置
2. 搜索并消除 `eval` / `new Function`
3. 搜索并迁移 `onclick`、内联 `<script>`
4. 评估是否用 nonce 作为短期过渡
5. 最终移除 `unsafe-inline` 与 `unsafe-eval`

---

## 十、附：给安全团队/项目组的简版说明

可直接引用如下：

> 当前问题为 CSP 响应头中包含 `unsafe-inline` 与 `unsafe-eval`，会削弱浏览器对 XSS 的缓解能力。整改方案为：
> 1. 移除 `unsafe-eval`，排查并替换所有依赖 eval/new Function 的实现；
> 2. 移除 `unsafe-inline`，将内联脚本和内联事件处理迁移为外部脚本绑定，必要时短期使用 nonce 机制过渡；
> 3. 按实际业务依赖收紧 `script-src`、`style-src`、`connect-src`、`img-src` 白名单；
> 4. 补充 `object-src 'none'`、`base-uri 'self'`、`frame-ancestors` 等安全指令。
