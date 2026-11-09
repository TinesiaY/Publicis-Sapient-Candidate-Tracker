import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import App from "./App"

vi.mock("./api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/client")>()
  return { ...actual, listCandidates: vi.fn().mockResolvedValue([]) }
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
