// app/lib/connections.ts
import { supabase } from './supabase';

export type AudienceLabel = 'Close Friends' | 'Family' | 'Colleagues';

function throwIf(e?: { message?: string }) {
  if (e) throw new Error(e.message || 'Unexpected error');
}

/** Owner → invite someone by their email */
export async function inviteConnectionByEmail(email: string) {
  const { data, error } = await supabase.rpc('invite_connection_by_email', {
    p_member_email: email,
  });
  throwIf(error);
  return data as { owner_id: string; member_id: string; status: 'pending' };
}

/** Member → accept an invite from a specific owner (by owner id) */
export async function acceptConnectionByOwner(ownerId: string) {
  const { data, error } = await supabase.rpc('accept_connection_by_owner', {
    p_owner: ownerId,
  });
  throwIf(error);
  return data;
}

/** Member → accept an invite from a specific owner (by owner email) */
export async function acceptConnectionByOwnerEmail(ownerEmail: string) {
  const { data, error } = await supabase.rpc('accept_connection_by_owner_email', {
    p_owner_email: ownerEmail,
  });
  throwIf(error);
  return data;
}

/** Either side → remove the connection with the other user */
export async function removeConnection(otherUserId: string) {
  const { error } = await supabase.rpc('remove_connection', {
    p_other_id: otherUserId,
  });
  throwIf(error);
}

/** Owner → replace all labels for a member (atomic) */
export async function setMemberLabels(memberId: string, labels: AudienceLabel[]) {
  const { data, error } = await supabase.rpc('set_member_labels', {
    p_member_id: memberId,
    p_labels: labels,
  });
  throwIf(error);
  return data as { owner_id: string; member_id: string; labels: AudienceLabel[] };
}

/** Owner → replace labels by member email */
export async function setMemberLabelsByEmail(email: string, labels: AudienceLabel[]) {
  const { data, error } = await supabase.rpc('set_member_labels_by_email', {
    p_member_email: email,
    p_labels: labels,
  });
  throwIf(error);
  return data as { owner_id: string; member_id: string; labels: AudienceLabel[] };
}