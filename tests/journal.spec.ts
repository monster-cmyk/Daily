import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";

async function openDay(page: Page, key = "2026-10-21") {
  await page.goto("/");
  await page.getByLabel("기록 날짜 선택").fill(key);
}
async function addTask(page: Page, title: string) {
  await page.getByRole("textbox", { name: "새 할 일" }).fill(title);
  await page.getByRole("button", { name: "추가", exact: true }).click();
}
async function addEntry(page: Page, text: string) {
  await page
    .getByRole("textbox", { name: "하루 기록", exact: true })
    .fill(text);
  await page.getByRole("button", { name: "기록 남기기" }).click();
}

test("빈 상태에서 할 일을 추가하고 완료하면 새로고침 후에도 유지된다", async ({
  page,
}) => {
  await openDay(page);
  await expect(page.getByText("등록된 할 일이 없습니다.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "기록 남기기" }),
  ).toBeDisabled();
  await addTask(page, "책 10쪽 읽기");
  await page.getByRole("checkbox", { name: "책 10쪽 읽기" }).check();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await page.reload();
  await page.getByLabel("기록 날짜 선택").fill("2026-10-21");
  await expect(
    page.getByRole("checkbox", { name: "책 10쪽 읽기" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "책 10쪽 읽기 삭제" }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
});

test("기록 분류, 수정, 삭제가 저장된다", async ({ page }) => {
  await openDay(page);
  await page.getByRole("button", { name: "배움", exact: true }).click();
  await addEntry(
    page,
    "오늘 처음으로 React를 배웠다.\n작은 앱을 직접 만들었다.",
  );
  const article = page.getByRole("article");
  await expect(article).toContainText("배움");
  await expect(article).toContainText("작은 앱을 직접 만들었다.");
  await page.getByRole("button", { name: "기록 수정", exact: true }).click();
  await page
    .getByRole("textbox", { name: "하루 기록", exact: true })
    .fill("수정한 오늘의 기록");
  await page.getByRole("button", { name: "수정 저장" }).click();
  await page.reload();
  await page.getByLabel("기록 날짜 선택").fill("2026-10-21");
  await expect(article).toContainText("수정한 오늘의 기록");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "기록 삭제", exact: true }).click();
  await expect(article).toHaveCount(0);
});

test("하루 평가와 회고가 날짜별로 분리되어 유지된다", async ({ page }) => {
  await openDay(page);
  await page.getByRole("button", { name: "좋음", exact: true }).click();
  await page
    .getByRole("textbox", { name: "회고" })
    .fill("중요한 일을 끝냈다. 내일은 산책을 해보자.");
  await page.getByLabel("기록 날짜 선택").fill("2026-10-20");
  await expect(page.getByRole("textbox", { name: "회고" })).toBeEmpty();
  await expect(
    page.getByRole("button", { name: "좋음", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await addEntry(page, "어제의 기록");
  await page.getByLabel("기록 날짜 선택").fill("2026-10-21");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "좋음", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page.getByLabel("기록 날짜 선택").fill("2026-10-21");
  await expect(page.getByRole("textbox", { name: "회고" })).toHaveValue(
    "중요한 일을 끝냈다. 내일은 산책을 해보자.",
  );
});

test("돌아보기에서 실제 주간 합계를 확인하고 기록으로 이동한다", async ({
  page,
}) => {
  await openDay(page);
  await addTask(page, "산책하기");
  await page.getByRole("checkbox", { name: "산책하기" }).check();
  await addEntry(page, "기분 좋은 산책을 했다.");
  await page.getByRole("button", { name: "매우 좋음" }).click();
  await page.getByLabel("기록 날짜 선택").fill("2026-10-20");
  await addEntry(page, "어제는 독서를 했다.");
  await page.getByRole("button", { name: "보통", exact: true }).click();
  await page.getByRole("button", { name: "돌아보기", exact: true }).click();
  const stats = page.locator(".review-stats");
  await expect(stats).toContainText("2 / 7일");
  await expect(stats).toContainText("1 / 1개");
  await expect(stats).toContainText("4.0 / 5");
  await page.getByRole("button", { name: /10월 21일 기록 1개 보기/ }).click();
  await expect(page.getByRole("article")).toContainText(
    "기분 좋은 산책을 했다.",
  );
});

test("백업과 복원은 확인 후에만 기록을 교체하고 잘못된 파일은 거부한다", async ({
  page,
}) => {
  await openDay(page);
  await addEntry(page, "반드시 보존되어야 하는 기록");
  await page.getByRole("button", { name: "데이터 관리", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /전체 기록 백업하기/ }).click();
  const download = await downloadPromise;
  const content = await readFile((await download.path())!, "utf8");
  expect(JSON.parse(content).days["2026-10-21"].entries[0].text).toBe(
    "반드시 보존되어야 하는 기록",
  );
  await page.getByLabel("백업 파일 선택").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":1,"days":{"wrong":{}}}'),
  });
  await expect(page.getByRole("alert")).toContainText(
    "올바른 daily. 백업 파일이 아니에요",
  );
  await page.getByLabel("백업 파일 선택").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(content),
  });
  await expect(page.getByText("1일의 기록을 불러올까요?")).toBeVisible();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByText("1일의 기록을 불러올까요?")).not.toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await addEntry(page, "임시로 추가한 기록");
  await page.getByRole("button", { name: "데이터 관리", exact: true }).click();
  await page.getByLabel("백업 파일 선택").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(content),
  });
  await page
    .getByRole("button", { name: "현재 기록을 바꾸고 불러오기" })
    .click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText(
    "반드시 보존되어야 하는 기록",
  );
});

test("저장된 데이터가 손상되면 덮어쓰지 않고 원본을 백업할 수 있다", async ({
  page,
}) => {
  const original = "{broken-json-preserve-me";
  await page.addInitScript(
    (value) => localStorage.setItem("daily.journal.v1", value),
    original,
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "원래 데이터 보호를 위해 자동 저장을 멈췄습니다",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("daily.journal.v1")),
  ).toBe(original);
  await page.getByRole("button", { name: "데이터 관리", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /저장된 원본 백업하기/ }).click();
  const downloaded = await downloadPromise;
  expect(await readFile((await downloaded.path())!, "utf8")).toBe(original);
});

test("모바일 화면에서 기록하고 주요 화면을 가로 스크롤 없이 사용할 수 있다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDay(page);
  await addTask(page, "모바일에서 오늘 기록하기");
  await page
    .getByRole("checkbox", { name: "모바일에서 오늘 기록하기" })
    .check();
  await addEntry(page, "휴대폰에서도 편안하게 기록하기");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "돌아보기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "이번 주 통계" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "데이터 관리", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("작성 중인 기록을 두고 날짜를 바꾸면 사용자가 이동을 취소할 수 있다", async ({
  page,
}) => {
  await openDay(page);
  await page
    .getByRole("textbox", { name: "하루 기록", exact: true })
    .fill("작성 중인 생각");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByLabel("기록 날짜 선택").fill("2026-10-20");
  await expect(
    page.getByRole("textbox", { name: "하루 기록", exact: true }),
  ).toHaveValue("작성 중인 생각");
  await expect(page.getByLabel("기록 날짜 선택")).toHaveValue("2026-10-21");
});
