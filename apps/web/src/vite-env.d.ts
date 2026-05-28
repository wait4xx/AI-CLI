/// <reference types="vite/client" />

// [L7修复] 环境变量类型定义
interface ImportMetaEnv {
  readonly VITE_WS_URL?: string
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
