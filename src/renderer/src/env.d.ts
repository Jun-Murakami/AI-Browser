/// <reference types="vite/client" />

// Monaco が参照するグローバルオブジェクト `MonacoEnvironment` を型レベルで定義しておく。
// 実体は `useWorker.ts` 内で `self.MonacoEnvironment = { getWorker: ... }` により設定される。
// Renderer(Window) と Worker 両方のグローバルに存在し得るため、それぞれを拡張する。
declare global {
  /**
   * Monaco が期待する `MonacoEnvironment` の最小構成。
   * - moduleId は Monaco から渡される識別子（未使用でも保持）
   * - label は言語や種別を示すラベル
   */
  interface MonacoEnvironmentConfig {
    getWorker(moduleId: string, label: string): Worker;
  }

  interface Window {
    MonacoEnvironment?: MonacoEnvironmentConfig;
  }

  interface WorkerGlobalScope {
    MonacoEnvironment?: MonacoEnvironmentConfig;
  }
}

export {};
