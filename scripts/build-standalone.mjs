import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { strToU8, zipSync } from "fflate";

const root = fileURLToPath(new URL("../", import.meta.url));
const result = await build({
  absWorkingDir: root,
  entryPoints: ["src/main.tsx"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: "daily.js",
  write: false,
  minify: true,
  legalComments: "inline",
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".woff2": "dataurl" },
});

const javascript = result.outputFiles.find((file) => file.path.endsWith(".js"));
const stylesheet = result.outputFiles.find((file) =>
  file.path.endsWith(".css"),
);
if (!javascript || !stylesheet)
  throw new Error("독립 실행 파일 빌드에 실패했습니다.");
const icon = await readFile(new URL("../public/favicon.svg", import.meta.url));
const fontLicense = await readFile(
  new URL("../public/Pretendard-LICENSE.txt", import.meta.url),
  "utf8",
);
const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#16372f" />
    <meta name="description" content="매일 한 일을 기록하고 나를 돌아보는 개인 공간" />
    <link rel="icon" href="data:image/svg+xml;base64,${icon.toString("base64")}" />
    <title>daily. — 일일 기록</title>
    <style>/*! ${fontLicense.replace(/\*\//g, "* /")} */
${stylesheet.text.replace(/<\/style/gi, "<\\/style")}</style>
  </head>
  <body>
    <div id="root"></div>
    <noscript>daily.를 사용하려면 브라우저에서 JavaScript를 허용해주세요.</noscript>
    <script>${javascript.text.replace(/<\/script/gi, "<\\/script")}</script>
  </body>
</html>
`;
await writeFile(new URL("../daily.html", import.meta.url), html);
await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
await writeFile(new URL("../dist/daily.html", import.meta.url), html);
const guide = `daily. 시작하기

1. Daily.zip을 컴퓨터에 내려받고 압축을 풀어주세요.
2. 압축을 푼 폴더의 daily.html을 Chrome 또는 Edge로 열어주세요.
3. 사용하던 파일 이름과 위치를 유지하면 같은 브라우저에서 기록을 이어갈 수 있습니다.

이 채팅의 파일 미리보기에서 열려고 하지 마세요. 개인 컴퓨터의 일반 브라우저에서 사용하도록 만든 파일입니다.
글꼴은 Pretendard이며, 글꼴과 앱 코드가 모두 HTML 파일 안에 들어 있습니다.
별도 설치나 인터넷 연결은 필요하지 않습니다. 현재 공개 웹 주소는 없습니다.

기록은 현재 기기의 현재 브라우저에 저장됩니다. 다른 기기와 자동 동기화되지 않습니다.
브라우저 데이터를 지우거나 파일을 옮기기 전에, 앱의 데이터 관리에서 JSON 백업을 내려받으세요.
로컬 파일의 저장을 차단하는 브라우저에서는 저장 경고가 표시됩니다.
`;
await writeFile(
  new URL("../Daily.zip", import.meta.url),
  zipSync(
    {
      "daily.html": strToU8(html),
      "READ-ME.txt": strToU8(guide),
      "Pretendard-LICENSE.txt": strToU8(fontLicense),
    },
    { level: 6 },
  ),
);
console.log(
  `daily.html 생성 완료 (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB). 서버 없이 파일로 열 수 있습니다.`,
);
console.log("Daily.zip 다운로드 묶음을 생성했습니다.");
