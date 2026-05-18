# Missing Referrer-Policy Header 整改说明

## 一、问题概述

本次安全扫描发现目标系统响应头中缺少推荐安全头 **`Referrer-Policy`**。

对应报告信息如下：

- **Issue Name**: Missing Referrer-Policy Header
- **Risk Level**: Low
- **CVSS 3.1**: 3.1
- **Vector**: `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N`
- **Issue Status**: Open
- **OWASP Top 10**: A05 Security Misconfiguration
- **Affected Component**: `https://api.hkuat.manulife.com.hk/ext/hk-ado-portal-function-service-env2/ebs/aws_main.jsp?action=quotation_aw05404_save&agent_type=AGENT`
- **Affected Service**: Change Payment Mode service

---

## 二、这是什么问题

这个问题本质上是：

> 服务端响应里没有设置 `Referrer-Policy`，或者设置得不合适，导致浏览器在向其他页面、第三方资源、外部站点发请求时，可能会带出过多的来源页面信息（Referer）。

这里要区分两个概念：

- **Referer**：浏览器请求头，表示“我是从哪个页面跳过来的”
- **Referrer-Policy**：服务端告诉浏览器，“这个 Referer 头允许带多少信息出去”

如果没有这个头，浏览器会按默认策略处理。默认行为未必符合你们安全要求，尤其是：

- 页面 URL 里有业务路径信息
- URL 里带 query 参数
- 页面会加载第三方资源或跳外链

这种情况下，就可能把不该暴露的路径、参数、页面结构信息带给外部目标。

---

## 三、风险点在哪里

### 1. 泄露来源页面路径
如果用户从一个内部业务页面跳到外部资源，或者页面加载第三方资源，浏览器可能会在请求里带上来源地址。

这可能暴露：

- 系统路径结构
- 功能页名称
- 页面层级关系
- 内部模块命名方式

### 2. 泄露 URL query 参数
如果 URL 中存在敏感参数，比如：

- policyKey
- customerId
- session-like identifier
- 业务单号

而又没有限制 Referer 发送策略，那么这些参数理论上可能随着 Referer 被带到第三方域名。

### 3. 增强攻击者信息收集能力
攻击者可以通过第三方资源、外链跳转等方式，间接收集：

- 系统页面命名
- URL 结构
- 参数模式
- 业务流程入口

这些信息虽然不一定直接导致入侵，但会降低系统的安全边界，便于后续定向攻击、钓鱼、社会工程等。

---

## 四、为什么会被扫出来

这类问题属于 **安全响应头缺失**，通常归类到：

- **OWASP Top 10 A05: Security Misconfiguration**

扫描工具一般只要发现响应头里缺少：

```http
Referrer-Policy
```

就会直接报出来。

也就是说，这个问题通常不是业务逻辑 bug，而是：

- 网关层没配
- Nginx / Ingress 没配
- 后端统一安全头没配
- JSP / Java 应用没有统一追加

由于受影响地址是 `aws_main.jsp`，所以它大概率也是：

- **统一网关层 / 统一 JSP 容器层 / Java 响应头配置层** 的问题
- 不一定是 React 页面代码直接导致的

---

## 五、推荐修复思路

这个问题很好修，通常也是**改一个地方覆盖很多页面**的典型安全项。

### 方案原则

在响应头中显式增加：

```http
Referrer-Policy
```

并设置一个合适的策略值。

---

## 六、推荐策略值

### 推荐值：`strict-origin-when-cross-origin`

这是目前最常见、最平衡的推荐值。

```http
Referrer-Policy: strict-origin-when-cross-origin
```

### 它的行为是

#### 同源请求
发送完整 Referer。

比如系统内页面跳转或同域资源请求，影响较小。

#### 跨源请求
只发送 **origin**，不发送完整路径和 query。

比如：

来源页面：

```txt
https://api.hkuat.manulife.com.hk/ext/hk-ado-portal-function-service-env2/ebs/aws_main.jsp?action=quotation_aw05404_save&agent_type=AGENT
```

跨域时只会发送：

```txt
https://api.hkuat.manulife.com.hk/
```

不会把后面的路径和参数带出去。

#### HTTPS → HTTP 降级请求
不发送 Referer。

这个也符合更安全的默认期望。

---

## 七、其他可选策略

### 1. `no-referrer`
最严格。

```http
Referrer-Policy: no-referrer
```

含义：任何请求都不发送 Referer。

优点：
- 最安全
- 最不容易泄露路径和参数

缺点：
- 某些依赖来源页判断的统计、联动、跳转可能受影响

适合：
- 非常敏感系统
- 对来源页分析没有依赖的场景

---

### 2. `same-origin`
只在同源请求时发送 Referer，跨域一律不发。

```http
Referrer-Policy: same-origin
```

优点：
- 也比较安全
- 不会给外域带出任何来源信息

缺点：
- 比 `strict-origin-when-cross-origin` 更严格
- 可能影响某些跨域统计或联动需求

---

### 3. `origin`
无论同源还是跨源，只发送 origin，不发送完整路径。

```http
Referrer-Policy: origin
```

优点：
- 简单直接
- 不暴露路径和 query

缺点：
- 同源场景下也丢失页面级来源信息

---

## 八、不建议的策略

### 1. 不设置
这就是现在的问题。

### 2. `unsafe-url`

```http
Referrer-Policy: unsafe-url
```

这个策略会在很多场景下发送完整 URL，包括路径和 query。

如果 URL 上有业务参数、标识符、敏感路径信息，就容易带出去。

所以不建议。

---

## 九、建议修复方案

### 推荐最终方案

直接统一加：

```http
Referrer-Policy: strict-origin-when-cross-origin
```

这是最适合作为企业系统默认值的方案。

原因：

- 安全性和兼容性平衡较好
- 可以避免跨域请求带出完整路径和参数
- 一般不会对正常业务造成明显影响
- 很多安全基线都接受这个值

---

## 十、修复位置建议

优先查这些地方：

### 1. 网关 / Nginx / Ingress
如果响应头是在统一入口层控制的，优先在这里加。

优点：
- 一次改动可覆盖多个服务
- 最少业务改动
- 最适合这种安全头问题

#### Nginx 示例

```nginx
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

---

### 2. Java Filter / Servlet Filter
如果是 Java 应用直接返回 JSP 页面，也可以在统一 Filter 里加。

#### Java 示例

```java
response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
```

---

### 3. Spring Security
如果项目用了 Spring Security，也可以在统一安全配置里加 header。

示意：

```java
http
  .headers(headers -> headers
    .addHeaderWriter((request, response) -> {
      response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    })
  );
```

---

### 4. JSP 公共模板层
如果页面都经过统一 JSP 容器模板输出，也可以在公共模板层补。

不过通常还是建议统一走网关或后端 header 配置，不要散落在单页面里。

---

## 十一、最小改动落地顺序

建议这么做：

### 第一步：先确认头是在哪一层加最合适
优先选择统一入口层。

### 第二步：全局补充响应头
加上：

```http
Referrer-Policy: strict-origin-when-cross-origin
```

### 第三步：验证关键页面
重点验证：

- Change Payment Mode service
- 其他同一入口下的 JSP 页面
- 是否存在外链、第三方资源、埋点、统计、下载、跳转逻辑受影响

### 第四步：复测
使用浏览器开发者工具或抓包工具确认响应头已返回。

---

## 十二、修复收益

修复后可以：

- 避免跨域请求带出完整页面路径
- 避免 URL query 参数通过 Referer 泄露给第三方
- 降低页面结构被动暴露风险
- 满足安全扫描对推荐安全头的要求
- 提升统一安全基线

---

## 十三、和前面两个 issue 的关系

这个 issue 和前面两个问题是互相有关联的：

### 1. Sensitive Information in URL
如果 URL 里有 `policyKey` 这类敏感参数，而又没有合适的 Referrer-Policy，那么参数更容易通过 Referer 泄露给外域。

### 2. CSP Misconfiguration
CSP 是控制页面可加载/执行什么资源；Referrer-Policy 是控制请求时带多少来源信息。

两者都属于：

- 安全头配置问题
- 统一配置优先修复的问题

所以这三个 issue 可以一起归类到：

- 浏览器端安全头与前端传参安全整改

---

## 十四、建议结论

本问题属于典型的 **安全响应头缺失**，修复成本低，收益明确，建议优先在统一层补齐：

```http
Referrer-Policy: strict-origin-when-cross-origin
```

如果后续安全要求更严格，也可以评估进一步调整为：

- `same-origin`
- `no-referrer`

但从兼容性和实用性来看，当前最推荐的是：

```http
strict-origin-when-cross-origin
```

---

## 十五、给安全团队/项目组的简版说明

可直接引用如下：

> 当前问题为应用响应头缺少 `Referrer-Policy`，可能导致浏览器在跨域请求或外链场景中带出过多来源页面信息，包括内部路径及 URL 参数。整改方案为：在统一响应头配置层补充 `Referrer-Policy: strict-origin-when-cross-origin`，从而在跨域请求时仅发送 origin，不暴露完整路径和 query 参数。建议优先在网关、Nginx、Spring Security 或统一后端 Filter 中集中配置，以最小改动覆盖多个页面与服务。
