import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint flat config (ESLint 9+).
 *
 * [AUDIT] Өмнө нь `apps/nextn/.eslintrc.json` (хуучин формат) байсан бөгөөд
 * ESLint 10 нь flat config шаарддаг тул линтер ОГТ АЖИЛЛАХГҮЙ байв. Мөн
 * Next 16-д `next lint` устсан, `next.config.ts`-ийн `eslint` түлхүүр ч
 * зөвшөөрөгдөхөө больсон — өөрөөр хэлбэл төсөлд ямар ч линт үлдээгүй байлаа.
 *
 * Ажиллуулах:  npm run lint      (засах: npm run lint:fix)
 */
const config = [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/.nx/**",
      "**/*.tsbuildinfo",
      "apps/nextn/next-env.d.ts",
    ],
  },

  ...coreWebVitals,
  ...nextTypescript,

  {
    // Next-ийн дүрмүүд `apps/nextn` дотор л утгатай; backend нь Nest тул
    // хуудасны бүтэцтэй холбоотой шалгалтуудыг тэнд хэрэглэхгүй.
    files: ["apps/backend/**/*.ts"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
    },
  },

  {
    // [AUDIT] React-ийн хувилбарыг ИЛ зааж өгнө. Заахгүй бол
    // eslint-plugin-react нь автомат илрүүлэлт рүү орж, ESLint 10-д устсан
    // `context.getFilename()` API дуудаад бүх линт уначихдаг.
    settings: { react: { version: "19.2" } },
  },

  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Nest-ийн DI, ClickHouse-ийн мөрийн төрөл зэрэг зарим газар `any`
      // шаардагддаг — алдаа биш, аажмаар багасгах сануулга.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // ── React Hooks ──────────────────────────────────────────────────
      // Сонгодог, өндөр үнэ цэнтэй хоёр дүрэм — эдгээр нь жинхэнэ алдаа
      // барьдаг тул хатуу үлдээнэ.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // [AUDIT] eslint-plugin-react-hooks v7 нь React Compiler-ийн шинэ
      // шалгуудыг авчирсан. Эдгээр нь "энэ хэв маяг compiler-д тохирохгүй"
      // гэж заадаг бөгөөд одоо байгаа кодод 127 алдаа өгч байв — ихэнх нь
      // ажиллаж буй кодын жинхэнэ алдаа БИШ. Харагдаж байхаар сануулга
      // болгосон; цаашид тус бүрчлэн шийдэж, дараа нь error болгож болно.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
];

export default config;
