import { UNASSIGNED_COLOR, UNASSIGNED_LABEL, type FamilyMember } from '../domain';

export function ownerOf(members: ReadonlyMap<string, FamilyMember>, memberId: string | null): { name: string; color: string; phone?: string } {
  const member = memberId ? members.get(memberId) : undefined;
  return { name: member?.fullName ?? UNASSIGNED_LABEL, color: member?.color ?? UNASSIGNED_COLOR, ...(member?.phone ? { phone: member.phone } : {}) };
}
