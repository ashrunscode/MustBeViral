export const actorTypes = ['user', 'machine', 'system'] as const;

export type ActorType = (typeof actorTypes)[number];

export interface Actor {
  readonly id: string;
  readonly type: ActorType;
}

export function isActorType(value: string): value is ActorType {
  return actorTypes.some((candidate) => candidate === value);
}
