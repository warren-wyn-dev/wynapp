export type RelationshipFacts = {
  viewerId: string;
  targetId: string;
  blockedEitherWay: boolean;
  accountVisibility: 'PUBLIC' | 'PRIVATE';
  viewerFollowsTarget: boolean;
};

export const canFollow = (facts: RelationshipFacts): boolean =>
  facts.viewerId !== facts.targetId && !facts.blockedEitherWay;
export const canBlock = (viewerId: string, targetId: string): boolean =>
  viewerId !== targetId;
export const canMute = canBlock;
export const canInteract = (blockedEitherWay: boolean): boolean =>
  !blockedEitherWay;
export const canViewProfile = (facts: RelationshipFacts): boolean =>
  !facts.blockedEitherWay &&
  (facts.accountVisibility === 'PUBLIC' ||
    facts.viewerId === facts.targetId ||
    facts.viewerFollowsTarget);
export const canViewFollowers = canViewProfile;
export const canApproveFollowRequest = (
  actorId: string,
  targetId: string,
): boolean => actorId === targetId;
export const canRejectFollowRequest = canApproveFollowRequest;
export const canCancelFollowRequest = (
  actorId: string,
  requesterId: string,
): boolean => actorId === requesterId;
export const canRemoveFollower = (
  actorId: string,
  followedId: string,
): boolean => actorId === followedId;
