# 常见安全整改 Demo

## 1. TanStack Router：敏感参数从 URL 改到 state

### before
```ts
navigate({
  to: '/activity-detail',
  search: { epmRefNo, policyKey },
})
```

### after
```ts
navigate({
  to: '/activity-detail',
  search: { epmRefNo },
  state: { policyKey },
})
```

### useAppNavigate demo
```ts
export function useAppNavigate() {
  const navigate = useNavigate()

  return (options) => {
    const search = { ...(options.search ?? {}) }
    const state = { ...(options.state ?? {}) }

    if (search.policyKey) {
      state.policyKey = search.policyKey
      delete search.policyKey
    }

    return navigate({
      ...options,
      search,
      state,
    })
  }
}
```

---

## 2. Nginx：补 CSP / Referrer-Policy / Clickjacking 头

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https://api.hkuat.manulife.com.hk; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "SAMEORIGIN" always;
```

如果完全不允许 iframe：
```nginx
add_header X-Frame-Options "DENY" always;
```

---

## 3. Spring Security：统一加安全头

```java
http.headers(headers -> headers
  .addHeaderWriter((request, response) -> {
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("X-Frame-Options", "SAMEORIGIN");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self';"
    );
  })
);
```

---

## 4. Java Filter：统一响应头

```java
public class SecurityHeaderFilter implements Filter {
  @Override
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException, ServletException {
    HttpServletResponse http = (HttpServletResponse) response;
    http.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    http.setHeader("X-Frame-Options", "SAMEORIGIN");
    http.setHeader("Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self';");
    chain.doFilter(request, response);
  }
}
```

---

## 5. 移除内联事件

### before
```html
<button onclick="saveQuote()">Save</button>
```

### after
```html
<button id="save-btn">Save</button>
```

```js
document.getElementById('save-btn')?.addEventListener('click', saveQuote)
```

---

## 6. 全局异常处理

### Spring Boot ControllerAdvice demo
```java
@RestControllerAdvice
public class GlobalExceptionHandler {
  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, String>> handle(Exception ex) {
    Map<String, String> body = new HashMap<>();
    body.put("errorCode", "SYSTEM_ERROR");
    body.put("message", "System is temporarily unavailable");
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
  }
}
```

---

## 7. TLS 配置方向（示意）

目标：
- 禁用 SSLv3 / TLS1.0 / TLS1.1
- 启用 TLS1.2 / TLS1.3
- 禁用弱 cipher / CBC 优先级
- 优先 GCM / ChaCha20

Nginx 示例方向：
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers HIGH:!aNULL:!MD5:!3DES:!CBC;
```

> 具体 cipher 需要结合你们运维基线、网关能力、合规要求确认。
