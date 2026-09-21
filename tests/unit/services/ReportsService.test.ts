import { beforeEach, describe, expect, it } from "vitest";
import { ReportsService } from "@/services/ReportsService";
import { FakeAdminUserRepository, member } from "../../fakes/admin";
import { FakeReportsRepository } from "../../fakes/admin";
import { FakeDrawRepository } from "../../fakes/draws";

let reports: FakeReportsRepository;
let draws: FakeDrawRepository;
let users: FakeAdminUserRepository;
let service: ReportsService;

beforeEach(() => {
  reports = new FakeReportsRepository();
  reports.lines = [
    {
      paidAt: "2026-09-02T10:00:00Z",
      amountPaise: 49_900,
      poolPaise: 14_970,
      charityPaise: 4_990,
      platformPaise: 29_940,
    },
    {
      paidAt: "2026-08-02T10:00:00Z",
      amountPaise: 49_900,
      poolPaise: 14_970,
      charityPaise: 4_990,
      platformPaise: 29_940,
    },
  ];
  reports.totals = [
    {
      charityId: "c-1",
      name: "Neer Jal Trust",
      slug: "neer-jal",
      isActive: true,
      totalPaise: 9_980,
      contributorCount: 2,
    },
  ];
  draws = new FakeDrawRepository();
  users = new FakeAdminUserRepository();
  users.members = [
    member({
      subscription: {
        status: "active",
        interval: "month",
        currentPeriodEnd: "2026-10-01T00:00:00Z",
        source: "stripe",
        hasAccess: true,
      },
      scoreCount: 5,
    }),
  ];
  service = new ReportsService(reports, draws, users);
});

describe("overview", () => {
  it("assembles the summary, the months, the charities and the draws", async () => {
    const overview = await service.overview();
    expect(overview.summary.totalMembers).toBe(3);
    expect(overview.byMonth.map((m) => m.month)).toEqual(["2026-09", "2026-08"]);
    expect(overview.charities[0].name).toBe("Neer Jal Trust");
    expect(overview.draws).toEqual([]);
  });
});

describe("csv", () => {
  it("charities: rupees with two decimals", async () => {
    expect(await service.csv("charities")).toBe(
      "charity,slug,listed,total_inr,contributors\r\nNeer Jal Trust,neer-jal,true,99.80,2\r\n",
    );
  });

  it("payments: one row per month", async () => {
    const csv = await service.csv("payments");
    expect(csv.split("\r\n")[1]).toBe("2026-09,1,499.00,149.70,49.90,299.40");
  });

  it("members: subscription and score count", async () => {
    const csv = await service.csv("members");
    expect(csv.split("\r\n")[1]).toBe(
      "Priya Test,priya@kindscore.test,Neer Jal Trust,10%,active,2026-10-01T00:00:00Z,stripe,5,2026-09-01T00:00:00Z",
    );
  });

  it("draws: headers only when nothing is published", async () => {
    expect((await service.csv("draws")).split("\r\n")).toHaveLength(2);
  });
});
