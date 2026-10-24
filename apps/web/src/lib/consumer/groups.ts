import type { ConsumerDeps } from "./deps";
import { ConsumerError } from "./errors";
import type { ConsumerOrg, ConsumerTx } from "./store";
import { isUuid, requireName, requireSeatlimit, requireUuid } from "./validate";

/**
 * SPEC-093 FR-003 / FR-004 — the company group (C1.2–C1.5).
 *
 * A company group is a `corporate` org owned by the company account. Seat limit:
 * the number of seats the wxKanban plan pays for, counted over members OTHER than
 * the owner (the company account is a system account, not a seat): SPEC-093 US1 —
 * "seat limit 5 … owner plus 5". `null` = unlimited.
 *
 * Only corporate orgs are reachable here; a person's individual workspace is
 * reported as not found, so this API can never edit a private org. The owner's
 * role is set only by group creation and can never be changed or removed here.
 */

// [SCOPE 093 / T003] BEGIN — loadCompanyGroup
async function loadCompanyGroup(tx: ConsumerTx, orgid: string): Promise<ConsumerOrg> {
  const org = isUuid(orgid) ? await tx.lockOrg(orgid.toLowerCase()) : null;
  if (!org || org.plantype !== "corporate") throw new ConsumerError("org_not_found", 404);
  return org;
}
// [SCOPE 093 / T003] END

// [SCOPE 093 / T003] BEGIN — createCompanyGroup
export async function createCompanyGroup(
  deps: ConsumerDeps,
  body: Record<string, unknown>,
): Promise<{ orgid: string }> {
  const ownerUserid = requireUuid(body.ownerUserid, "ownerUserid");
  const name = requireName(body.name, "name");
  const seatlimit = requireSeatlimit(body);
  return deps.store.run(async (tx) => {
    if (!(await tx.userExists(ownerUserid))) throw new ConsumerError("user_not_found", 404);
    const orgid = deps.newId();
    await tx.insertOrg({ id: orgid, name, plantype: "corporate", seatlimit });
    await tx.insertOrgMember(orgid, ownerUserid, "owner");
    return { orgid };
  });
}
// [SCOPE 093 / T003] END

// [SCOPE 093 / T003] BEGIN — updateGroupSeatlimit
export async function updateGroupSeatlimit(
  deps: ConsumerDeps,
  orgid: string,
  body: Record<string, unknown>,
): Promise<{ orgid: string; seatlimit: number | null }> {
  const seatlimit = requireSeatlimit(body);
  return deps.store.run(async (tx) => {
    const org = await loadCompanyGroup(tx, orgid);
    if (seatlimit !== null) {
      const members = await tx.countNonOwnerMembers(org.id);
      if (members > seatlimit) throw new ConsumerError("below_members", 409, { members });
    }
    await tx.updateOrgSeatlimit(org.id, seatlimit);
    return { orgid: org.id, seatlimit };
  });
}
// [SCOPE 093 / T003] END

// [SCOPE 093 / T004] BEGIN — putGroupMember
/** C1.4 — add (no invitation) or re-role. Same role again → `added: false`, no change. */
export async function putGroupMember(
  deps: ConsumerDeps,
  orgid: string,
  userid: string,
  body: Record<string, unknown>,
): Promise<{ orgid: string; userid: string; role: "admin" | "member"; added: boolean }> {
  const role = body.role;
  if (role !== "admin" && role !== "member") throw new ConsumerError("invalid_request", 400, { field: "role" });
  return deps.store.run(async (tx) => {
    const org = await loadCompanyGroup(tx, orgid);
    if (!isUuid(userid) || !(await tx.userExists(userid.toLowerCase()))) {
      throw new ConsumerError("user_not_found", 404);
    }
    const uid = userid.toLowerCase();
    const current = await tx.getOrgRole(org.id, uid);
    if (current === "owner") throw new ConsumerError("owner_protected", 409);
    if (current !== null) {
      if (current !== role) await tx.updateOrgMemberRole(org.id, uid, role);
      return { orgid: org.id, userid: uid, role, added: false };
    }
    if (org.seatlimit !== null) {
      const used = await tx.countNonOwnerMembers(org.id);
      if (used + 1 > org.seatlimit) {
        throw new ConsumerError("seat_limit_reached", 409, { missing: used + 1 - org.seatlimit });
      }
    }
    await tx.insertOrgMember(org.id, uid, role);
    return { orgid: org.id, userid: uid, role, added: true };
  });
}
// [SCOPE 093 / T004] END

// [SCOPE 093 / T004] BEGIN — deleteGroupMember
/** C1.5 — remove. A non-member → `removed: false`; the owner → 409 owner_protected. */
export async function deleteGroupMember(
  deps: ConsumerDeps,
  orgid: string,
  userid: string,
): Promise<{ removed: boolean }> {
  return deps.store.run(async (tx) => {
    const org = await loadCompanyGroup(tx, orgid);
    if (!isUuid(userid)) return { removed: false };
    const uid = userid.toLowerCase();
    const current = await tx.getOrgRole(org.id, uid);
    if (current === null) return { removed: false };
    if (current === "owner") throw new ConsumerError("owner_protected", 409);
    await tx.deleteOrgMember(org.id, uid);
    return { removed: true };
  });
}
// [SCOPE 093 / T004] END
