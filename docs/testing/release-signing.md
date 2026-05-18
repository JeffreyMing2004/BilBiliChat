# Release Signing

## 当前报错含义
如果 GitHub Actions 出现：

```text
failed to decode secret key: incorrect updater private key password: Missing comment in secret key
```

通常不是 Tauri 构建失败，而是 `updater signing key` 本身格式不对，或在 GitHub Secret 中被破坏了换行结构。

## 正确做法
BilBiliChat 的工作流现在支持两种方式：

### 方式一：直接使用多行私钥
设置 GitHub Secret：

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

其中 `TAURI_SIGNING_PRIVATE_KEY` 必须是完整的 minisign 私钥原文，而不是公钥，也不是裁剪后的单行文本。

### 方式二：使用 Base64 私钥
更推荐公开 Beta 阶段使用：

- `TAURI_SIGNING_PRIVATE_KEY_BASE64`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

生成方式示例：

```bash
base64 < ~/.tauri/bilbilichat.key | pbcopy
```

然后把剪贴板内容保存到 `TAURI_SIGNING_PRIVATE_KEY_BASE64`。

## 正确的私钥特征
私钥文件应包含类似：

```text
untrusted comment: minisign encrypted secret key
...
```

如果你填进去的是：

- public key
- 缺少注释头的内容
- 被压成一行的文本
- 带有错误密码的其他 key

都会导致 updater 签名失败。

## 当前工作流行为
`.github/workflows/build.yml` 会优先读取：

1. `TAURI_SIGNING_PRIVATE_KEY_BASE64`
2. `TAURI_SIGNING_PRIVATE_KEY`

然后在 runner 上写入临时 key 文件，再传给 Tauri。
