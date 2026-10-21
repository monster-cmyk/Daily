import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";

test("독립 실행 HTML은 외부 자원 없이 실행되고 기록을 저장한다", async ({
  page,
  context,
}) => {
  const archive = unzipSync(await readFile(resolve("Daily.zip")));
  const html = strFromU8(archive["daily.html"]);
  expect(html).toBe(await readFile(resolve("daily.html"), "utf8"));
  expect(strFromU8(archive["READ-ME.txt"])).toContain("압축을 풀어주세요");
  expect(strFromU8(archive["Pretendard-LICENSE.txt"])).toContain(
    "SIL OPEN FONT LICENSE",
  );
  const url = "http://127.0.0.1:4173/standalone-under-test";
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(url, (route) =>
    route.fulfill({ contentType: "text/html; charset=utf-8", body: html }),
  );
  await context.setOffline(true);
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "하루 기록",
  );
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      Array.from(document.fonts).some(
        (font) =>
          font.family.includes("Pretendard Variable") &&
          font.status === "loaded",
      ),
    ),
  ).toBe(true);
  expect(
    await page
      .locator("body")
      .evaluate((element) => getComputedStyle(element).fontFamily),
  ).toContain("Pretendard Variable");
  await page
    .getByRole("textbox", { name: "새 할 일" })
    .fill("독립 실행 앱에서 기록하기");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "독립 실행 앱에서 기록하기" })
    .check();
  await page
    .getByRole("textbox", { name: "하루 기록", exact: true })
    .fill("앱과 글꼴을 모두 담은 하나의 페이지");
  await page.getByRole("button", { name: "기록 남기기" }).click();
  await page.getByRole("button", { name: "좋음", exact: true }).click();
  await page
    .getByRole("textbox", { name: "회고" })
    .fill("오늘의 작은 문제를 해결했다.");
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "독립 실행 앱에서 기록하기" }),
  ).toBeChecked();
  await expect(page.getByRole("article")).toContainText(
    "앱과 글꼴을 모두 담은 하나의 페이지",
  );
  await expect(
    page.getByRole("button", { name: "좋음", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox", { name: "회고" })).toHaveValue(
    "오늘의 작은 문제를 해결했다.",
  );
  await page.getByRole("button", { name: "돌아보기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "이번 주 통계" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(requests.every((request) => request === url)).toBe(true);
  expect(html).not.toMatch(/<script\b[^>]*\bsrc\s*=/i);
  expect(html).not.toMatch(/<link\b[^>]*\brel\s*=\s*["']stylesheet/i);
});

test("index.html을 파일로 열면 독립 실행 앱이 열리고 오프라인에서도 기록이 유지된다", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  const remoteRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) remoteRequests.push(request.url());
  });
  await context.setOffline(true);
  try {
    await page.goto(pathToFileURL(resolve("index.html")).href);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("ERR_BLOCKED_BY_ADMINISTRATOR")
    ) {
      test.skip(
        true,
        "관리형 Chromium의 URL 정책이 file: 탐색을 차단합니다. 정책을 변경하지 않으며, 독립 실행 HTML 자체는 별도 테스트로 검증합니다.",
      );
      return;
    }
    throw error;
  }
  await expect(page).toHaveURL(pathToFileURL(resolve("daily.html")).href);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "하루 기록",
  );

  await page
    .getByRole("textbox", { name: "새 할 일" })
    .fill("파일로 열어서 기록하기");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await page.getByRole("checkbox", { name: "파일로 열어서 기록하기" }).check();
  await page
    .getByRole("textbox", { name: "하루 기록", exact: true })
    .fill("서버가 없어도 오늘의 기록을 남길 수 있다.");
  await page.getByRole("button", { name: "기록 남기기" }).click();
  await page.getByRole("button", { name: "좋음", exact: true }).click();
  await page
    .getByRole("textbox", { name: "회고" })
    .fill("오늘의 작은 문제를 해결했다.");
  await page.reload();

  await expect(
    page.getByRole("checkbox", { name: "파일로 열어서 기록하기" }),
  ).toBeChecked();
  await expect(page.getByRole("article")).toContainText(
    "서버가 없어도 오늘의 기록을 남길 수 있다.",
  );
  await expect(
    page.getByRole("button", { name: "좋음", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox", { name: "회고" })).toHaveValue(
    "오늘의 작은 문제를 해결했다.",
  );
  await page.getByRole("button", { name: "돌아보기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "이번 주 통계" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(remoteRequests).toEqual([]);
});
