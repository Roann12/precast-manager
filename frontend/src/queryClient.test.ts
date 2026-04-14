// File overview: Core frontend setup and app-level wiring for queryClient.test.ts.
import { describe, expect, it } from "vitest";
import axios from "axios";
import { createQueryClient, formatQueryErrorMessage } from "./queryClient";

describe("formatQueryErrorMessage", () => {
  it("reads axios string detail", () => {
    const err = new axios.AxiosError("nope");
    err.response = { status: 400, data: { detail: "Bad input" } } as never;
    expect(formatQueryErrorMessage(err)).toBe("Bad input");
  });

  it("falls back for unknown errors", () => {
    expect(formatQueryErrorMessage(new Error("x"))).toBe("x");
    expect(formatQueryErrorMessage(null)).toBe("Something went wrong");
  });
});

describe("createQueryClient", () => {
  it("sets query retry defaults", () => {
    const client = createQueryClient(() => ({ error: () => undefined }));
    expect(client.getDefaultOptions().queries?.retry).toBe(1);
    expect(client.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });
});
