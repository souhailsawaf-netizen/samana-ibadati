import { describe, expect, it } from "vitest";
import { isStudentUsernameConflictError } from "./db";

describe("student username database conflicts", () => {
  it.each([
    "Duplicate entry 'student' for key 'local_accounts_username_idx'",
    "Duplicate entry 'local:student' for key 'users_openId_unique'",
    "Duplicate entry 'student' for key 'local_accounts.username'",
  ])("recognizes a duplicate username constraint: %s", sqlMessage => {
    expect(
      isStudentUsernameConflictError({ code: "ER_DUP_ENTRY", sqlMessage })
    ).toBe(true);
  });

  it.each([
    { code: "ECONNRESET", sqlMessage: "connection reset" },
    {
      code: "ER_DUP_ENTRY",
      sqlMessage: "Duplicate entry '1' for key 'users_id'",
    },
    { code: "ER_LOCK_WAIT_TIMEOUT", sqlMessage: "lock wait timeout" },
    null,
    "database failure",
  ])(
    "does not classify unrelated database failures as username conflicts",
    error => {
      expect(isStudentUsernameConflictError(error)).toBe(false);
    }
  );
});
