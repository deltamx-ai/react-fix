# Missing Referrer-Policy Header 风险整改说明

## 一、问题概述

本次安全扫描发现，目标系统响应头中**缺少 `Referrer-Policy` 安全头**，因此被识别为：

- **Risk Level**: Low
- **CVSS 3.1**: 3.1
- **Vector**: `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N`
- **Issue Status**: Open
- **OWASP Top 10**: A05 Security Misconfiguration
- **Affected Component**: `https://api.hkuat.manulife.com.hk/ext/hk-ado-portal-function-service-env2/ebs/aws_main.jsp?action=quotation_aw05404_save&agent_type=AGENT`
- **Affected Service**: Change Payment Mode service

---

## 二、这是什么问题

这个问题本质上是：**应用响应头没有正确声明 Referrer-Policy，导致浏览器在发起后续请求时，可能会把来源页面 URL 作为 Referer 头带给目标站点。**

浏览器默认会在很多跳转、图片请求、脚本请求、表单提交、第三方资源加载中自动带上 `Referer`。如果没有通过 `Referrer-Policy` 控制，就可能出现以下风险：

- 页面路径暴露给第三方站点
- query string 中的参数被带出去
- 用户浏览路径被外部服务感知
- 站点结构、页面命名、业务流程被外部推断

这类问题属于典型的：

**安全响应头缺失 / 安全配置不当**

也就是 OWASP Top 10 A05：**Security Misconfiguration**。

---

## 三、为什么会被扫出来

报告里的核心点是：

> 响应头里没有实现推荐安全头 `Referrer-Policy`

也就是说，测试方抓包看响应头时，没有看到类似下面这样的头：

```http
Referrer-Policy: strict-origin-when-cross-origin
```

或：

```http
Referrer-Policy: no-referrer
```

所以被判定为“缺失 Referrer-Policy Header”。

---

## 四、风险影响

### 1. 泄露页面路径和参数
如果当前页面 URL 里带有：

- query 参数
- 内部业务路径
- 敏感标识

当页面去请求第三方资源、跳转到外部页面时，这些信息有可能通过 `Referer` 暴露出去。

### 2. 暴露用户浏览行为
第三方服务可能通过 Referer 了解：

- 用户从哪个页面过来
- 当前业务流程在哪一步
- 访问了哪些功能模块

### 3. 帮助攻击者了解站点结构
如果外部系统反复接收到 Referer，就更容易推断：

- 页面命名规则
- 功能入口路径
- 业务参数结构
- 内部模块关系

如果 URL 里本身还存在敏感参数，这个问题的风险会进一步放大。

---

## 五、和你前面那个 policyKey 问题的关系

这个 issue 跟前面的 **Sensitive Information in URL** 是有关联的。

### 前一个问题
是：

- `policyKey` 出现在 URL 中

### 这个问题
是：

- 浏览器可能把当前 URL 通过 `Referer` 带到别的请求里

所以如果 URL 本身带敏感参数，而又**没有 Referrer-Policy**，两个问题叠加后，泄露面会更大。

也就是说：

- **先把敏感参数从 URL 移走**，是第一层修复
- **再补上 Referrer-Policy**，是第二层保护

这两个问题最好一起收口。

---

## 六、推荐修复方案

核心修复方式很简单：

## 在响应头中增加 `Referrer-Policy`

推荐值优先级如下。

### 方案 A：推荐默认值

```http
Referrer-Policy: strict-origin-when-cross-origin
```

含义：

- 同源请求：可带完整 referrer
- 跨域请求：只带 origin，不带完整路径和参数
- 从 HTTPS 降级到 HTTP：不发送 referrer

这是现在大多数系统比较平衡的推荐值。

### 方案 B：更严格

```http
Referrer-Policy: no-referrer
```

含义：

- 所有请求都不发送 referrer

优点：

- 保护最强

缺点：

- 某些统计、来源追踪、依赖 referrer 的业务逻辑可能受影响

### 方案 C：如果你们需要保留站点来源，但不想泄露路径

```http
Referrer-Policy: origin
```

含义：

- 只发送协议 + 域名 + 端口
- 不带路径和 query

比如只发送：

```txt
https://api.hkuat.manulife.com.hk
```

不会发送：

```txt
https://api.hkuat.manulife.com.hk/ext/hk-ado-portal-function-service-env2/ebs/aws_main.jsp?action=...
```

---

## 七、推荐值建议

对于当前这个场景，我建议优先使用：

```http
Referrer-Policy: strict-origin-when-cross-origin
```

原因：

- 安全性明显优于未配置
- 不会把完整路径和 query 暴露给跨域站点
- 兼顾大多数系统兼容性
- 是比较常见、容易被接受的企业默认值

如果安全团队要求更严格，可以再升级到：

```http
Referrer-Policy: no-referrer
```

---

## 八、修复位置判断

这个问题通常不是前端 React 组件里修，而是统一配置层修。

优先排查这些位置：

- Nginx
- API Gateway
- Ingress
- Java Filter / Servlet Filter
- Spring Security Header 配置
- JSP 公共入口页
- 统一 response header 注入位置

因为这是**响应头问题**，如果能在统一层修，一次可以覆盖很多页面。

---

## 九、具体修复示例

### 1. Nginx

```nginx
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### 2. Spring Security

可通过 header 配置统一添加。

示意：

```java
http
  .headers(headers -> headers
    .addHeaderWriter((request, response) -> {
      response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    })
  );
```

### 3. Servlet Filter

```java
response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
```

### 4. 网关 / 反向代理统一注入

如果当前系统所有 JSP/服务都通过统一入口出流量，建议直接在统一网关层加。

---

## 十、最小改动落地顺序

建议这样推进：

### 第一步：确认响应头在哪一层配置
先确认 `aws_main.jsp` 的响应头是：

- 后端应用直接设置
- 还是网关统一加的

### 第二步：统一补充 Referrer-Policy
优先在统一层补：

```http
Referrer-Policy: strict-origin-when-cross-origin
```

### 第三步：联动检查 URL 敏感参数问题
因为如果 URL 里还带敏感参数，即使补了 Referrer-Policy，仍然建议把敏感值从 URL 中移除。

### 第四步：回归验证
验证方式：

- 打开目标页面
- 抓取响应头
- 确认返回中存在：

```http
Referrer-Policy: strict-origin-when-cross-origin
```

---

## 十一、整改收益

补上这个头之后，可以获得这些收益：

- 降低来源 URL 泄露给第三方的概率
- 减少路径、query 参数、业务流转信息暴露
- 满足推荐安全头检查要求
- 降低与“敏感信息出现在 URL”类问题叠加后的泄露风险

---

## 十二、建议结论

本问题属于低风险配置类问题，修复成本通常较低，适合在统一配置层快速收口。

建议采取以下策略：

1. 在统一响应头配置层补充 `Referrer-Policy`
2. 推荐值使用：

```http
Referrer-Policy: strict-origin-when-cross-origin
```

3. 联动处理敏感参数出现在 URL 的问题
4. 将该头纳入系统默认安全响应头基线

---

## 十三、给安全团队/项目组的简版说明

可直接引用：

> 当前问题为响应头缺失 `Referrer-Policy`，可能导致浏览器在后续请求中泄露来源页面 URL 信息。整改方案为：在统一响应头配置层增加 `Referrer-Policy: strict-origin-when-cross-origin`，以限制跨域请求仅携带来源站点 origin，不暴露完整路径与 query 参数。同时建议联动处理 URL 中敏感参数问题，避免 referrer 泄露与敏感 URL 叠加放大风险。
