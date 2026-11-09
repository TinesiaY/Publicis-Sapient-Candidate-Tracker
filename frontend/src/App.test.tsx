import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import App from "./App"

vi.mock("./api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/client")>()
  return {
    ...actual,
    listCandidates: vi.fn().mockResolvedValue([]),
    listRoles: vi.fn().mockResolvedValue([]),
    getCandidateCounts: vi.fn().mockResolvedValue({
      total: 0,
      by_stage: { Applied: 0, Screening: 0, Interview: 0, Offer: 0, Rejected: 0 },
    }),
  }
})

describe("App", () => {
  it("shows the candidates page at /candidates", async () => {
    render(
      <MemoryRouter initialEntries={["/candidates"]}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole("heading", { name: "Candidates" })).toBeTruthy()
  })
})
