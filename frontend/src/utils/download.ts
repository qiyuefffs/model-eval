/** 浏览器端文件下载工具：统一触发下载并延迟释放 Object URL。 */

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // 延迟释放：部分浏览器在下载真正开始读取 blob 前同步 revoke 会导致下载失败/空文件。
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** 下载一个已有的 Blob（如接口返回的二进制响应）。 */
export function downloadBlob(blob: Blob, filename: string) {
  triggerDownload(blob, filename);
}

/** 下载一段文本内容（自动包成带 charset 的 Blob）。 */
export function downloadText(content: string, filename: string, mimeType: string) {
  triggerDownload(new Blob([content], { type: `${mimeType};charset=utf-8` }), filename);
}
