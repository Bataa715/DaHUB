import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Frontend-ийн unit тест.
 *
 * [AUDIT] Өмнө нь `apps/nextn`-д ганц ч тест байгаагүй — 163 файлын логик
 * бүхэлдээ шалгагдаагүй байв. Энэ тохиргоо нь DOM шаарддаггүй ЦЭВЭР логикт
 * (эрхийн шалгалт, огнооны туслах, зам задлагч, форматлагч) зориулагдсан.
 * React компонент рендерлэх тест хэрэгтэй бол `environment: "jsdom"` болгож,
 * @testing-library/react нэмнэ.
 */
export default defineConfig({
  resolve: {
    alias: {
      // tsconfig-ийн "@/*" -> "src/*" зурвасыг vitest-д таниулна
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.spec.{ts,tsx}",
        "src/components/ui/**",
        "src/contexts/translations.ts",
      ],
    },
  },
});
