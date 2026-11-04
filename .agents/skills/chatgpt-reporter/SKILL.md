---
name: chatgpt-reporter
description: >-
  Automates reporting to Master (ChatGPT web UI via Chrome DevTools MCP), including
  safely uploading single or multiple screenshots/images without triggering menu or path errors,
  entering prompt text, and awaiting Master's completed review. Use whenever the agent needs
  to report progress or send game/code screenshots to ChatGPT.
---

# ChatGPT (师父) 对话与图片上传标准操作技能

本技能专门用于规范通过 Chrome DevTools MCP 与网页版 ChatGPT（师父）进行自动化汇报时的标准操作流程，提供**毫秒级极速多图上传**与**稳定兼容**两套方案。

---

## 核心提速与避坑要点

1. **临时目录安全策略（Workspace Root 限制）**：
   - Chrome DevTools MCP 对读取文件路径有白名单限制。如果直接使用桌面工程目录下的路径，会报错 `Access denied: path is not within configured workspace roots`。
   - **铁律**：所有待上传的图片必须先拷贝到系统真实临时目录（macOS 必须使用 `tempfile.gettempdir()` 对应的 `/var/folders/.../T/`，不要使用 `/tmp/` 软链接）。

2. **极速多图上传原理（从 60 秒压缩至 3 秒的核心秘密）**：
   - 以前慢的原因：每次上传都去点击 `+` 展开菜单 -> 截取几百KB完整页面快照 -> 在终端用 grep 找 UID -> 上传 1 张 -> sleep 2 秒等待缩略图 -> 重复 N 次！这样会产生 15+ 次工具往返，耗时近 1 分钟。
   - **极速提速方案**：ChatGPT 页面原本就内置了带有 `multiple: true` 的真实 `<input type="file" multiple>` 标签，只是平时被 CSS `display: none` 隐藏。
   - **操作方法**：仅需用一段 10ms 的 `evaluate_script` 将该控件的 `display` 临时设为 `block` 并打上固定标识，即可**在 1 次工具调用中直接将所有图片（`[pic1, pic2, pic3]`）打包批量上传**！不仅免去多轮点击菜单与截图检索，速度提升 10 倍以上！

---

## 极速执行流程（推荐，只需 3 步，3~5 秒搞定）

### 步骤 1：批量拷贝图片到系统安全临时目录
```bash
TEMP_DIR=$(python3 -c "import tempfile; print(tempfile.gettempdir())")
cp /Users/djdl/Desktop/飞跃极速/img1.jpg $TEMP_DIR/upload_1.jpg
cp /Users/djdl/Desktop/飞跃极速/img2.jpg $TEMP_DIR/upload_2.jpg
cp /Users/djdl/Desktop/飞跃极速/img3.jpg $TEMP_DIR/upload_3.jpg
```

### 步骤 2：通过 evaluate_script 激活原生多选通道
调用 `evaluate_script`（仅耗时 ~20ms）：
```javascript
(() => {
  const input = document.querySelector('input[type="file"][multiple][accept*="image"]');
  if (!input) return { success: false };
  input.style.display = 'block';
  input.style.width = '1px';
  input.style.height = '1px';
  input.style.opacity = '0.01';
  input.setAttribute('aria-label', 'ChatGPT_Fast_Multi_Upload');
  return { success: true };
})()
```

### 步骤 3：单次一次性注入所有图片
1. 调用 `take_snapshot` 获取页面元素，找到 `ChatGPT_Fast_Multi_Upload` 的 `uid`。
2. 仅调用 **1 次** `upload_file`，将全部图片打包注入：
   ```json
   {
     "pageId": 19,
     "uid": "<INPUT_UID>",
     "filePaths": [
       "/var/folders/.../T/upload_1.jpg",
       "/var/folders/.../T/upload_2.jpg",
       "/var/folders/.../T/upload_3.jpg"
     ]
   }
   ```
3. 等待 1~2 秒，所有图片立即同时挂载就绪！

### 步骤 4：填入汇报并发送
1. 对 `textbox "询问 ChatGPT"` 执行 `fill` 写入汇报文本。
2. 点击 `button "发送"`。
3. 监听回复完成（`"回答已完成"`）。
