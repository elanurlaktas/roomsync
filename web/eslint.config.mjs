import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Bu proje ölçeğinde ekstra state kütüphanesi yok (Bölüm 8) — veri çeken
      // her ekran, `useEffect(() => { load(); }, [load])` + "Tekrar dene"
      // butonunda da yeniden kullanılan bir `load()` fonksiyonuyla çalışıyor.
      // Bu kural, setState'in effect içinde senkron çağrıldığını varsayıyor;
      // burada gerçek çağrı her zaman bir fetch promise'inin ardından, asenkron.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
