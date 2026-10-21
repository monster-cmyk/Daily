import { test, expect } from "@playwright/test";

test("월간 달력에 모든 날짜가 표시되고 월·연도 이동 및 윤년을 처리한다", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("기록 날짜 선택").fill("2026-10-21");
  const calendar = page.getByRole("region", { name: "월간 달력" });
  await expect(
    calendar.getByRole("heading", { name: "2026년 10월" }),
  ).toBeVisible();
  await expect(calendar.locator("[data-calendar-date]")).toHaveCount(31);
  await expect(
    calendar.locator('[data-calendar-date="2026-10-01"]'),
  ).toBeVisible();
  await expect(
    calendar.locator('[data-calendar-date="2026-10-31"]'),
  ).toBeVisible();
  await calendar.getByRole("button", { name: "이전 달", exact: true }).click();
  await expect(
    calendar.getByRole("heading", { name: "2026년 9월" }),
  ).toBeVisible();
  await expect(calendar.locator("[data-calendar-date]")).toHaveCount(30);
  await expect(page.getByLabel("기록 날짜 선택")).toHaveValue("2026-10-21");
  await page.getByLabel("기록 날짜 선택").fill("2026-12-31");
  await calendar.getByRole("button", { name: "다음 달", exact: true }).click();
  await expect(
    calendar.getByRole("heading", { name: "2027년 1월" }),
  ).toBeVisible();
  await page.getByLabel("기록 날짜 선택").fill("2024-02-01");
  await expect(calendar.locator("[data-calendar-date]")).toHaveCount(29);
  await expect(
    calendar.locator('[data-calendar-date="2024-02-29"]'),
  ).toBeVisible();
  await page.getByLabel("기록 날짜 선택").fill("2023-02-01");
  await expect(calendar.locator("[data-calendar-date]")).toHaveCount(28);
  await page.getByLabel("기록 날짜 선택").fill("2000-01-01");
  await expect(
    calendar.getByRole("button", { name: "이전 달", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("기록 날짜 선택").fill("2100-12-31");
  await expect(
    calendar.getByRole("button", { name: "다음 달", exact: true }),
  ).toBeDisabled();
});

test("월의 처음과 마지막 날짜를 선택해 기록을 구분하고 기존 저장 형식을 유지한다", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "daily.journal.v1",
      JSON.stringify({
        version: 1,
        days: {
          "2026-10-01": {
            tasks: [],
            entries: [
              {
                id: "existing",
                text: "기존 버전에 저장한 기록",
                category: "업무",
                createdAt: "2026-10-01T09:00:00Z",
              },
            ],
            rating: 4,
            reflection: "기존 회고",
          },
        },
      }),
    ),
  );
  await page.goto("/");
  await page.getByLabel("기록 날짜 선택").fill("2026-10-21");
  const firstDay = page.locator('[data-calendar-date="2026-10-01"]');
  await expect(firstDay).toHaveAccessibleName(/기록 있음/);
  await firstDay.click();
  await expect(page.getByRole("article")).toContainText(
    "기존 버전에 저장한 기록",
  );
  await expect(
    page.getByRole("textbox", { name: "회고", exact: true }),
  ).toHaveValue("기존 회고");
  await expect(
    page.getByRole("button", { name: "좋음", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-calendar-date="2026-10-31"]').click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "하루 기록", exact: true })
    .fill("월말 기록");
  await page.getByRole("button", { name: "기록 남기기", exact: true }).click();
  await firstDay.click();
  await expect(page.getByRole("article")).toContainText(
    "기존 버전에 저장한 기록",
  );
  await page.locator('[data-calendar-date="2026-10-31"]').click();
  await expect(page.getByRole("article")).toContainText("월말 기록");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("기록 날짜 선택")).toHaveValue("2026-11-01");
  await expect(
    page.getByRole("heading", { name: "2026년 11월", exact: true }),
  ).toBeVisible();
});

test("달력 월만 이동하면 작성 중인 내용이 유지되고 오늘 버튼으로 돌아온다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const today = await page.getByLabel("기록 날짜 선택").inputValue();
  await page
    .getByRole("textbox", { name: "하루 기록", exact: true })
    .fill("작성 중인 기록");
  await page.getByRole("button", { name: "다음 달", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "하루 기록", exact: true }),
  ).toHaveValue("작성 중인 기록");
  await expect(page.getByLabel("기록 날짜 선택")).toHaveValue(today);
  await page.getByRole("button", { name: "오늘", exact: true }).click();
  await expect(page.locator(`[data-calendar-date="${today}"]`)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("textbox", { name: "하루 기록", exact: true }),
  ).toHaveValue("작성 중인 기록");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
