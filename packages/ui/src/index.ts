export const UI_IMPLEMENTATION_GATE = 'superdesign-approval-required' as const;

export function mayImplementProductionUi(approvedArtifactId?: string): boolean {
  return typeof approvedArtifactId === 'string' && approvedArtifactId.trim().length > 0;
}

export {
  Button,
  Card,
  Chip,
  Dialog,
  Drawer,
  HairlineDivider,
  LedgerTable,
  MonoCaps,
  QuotePill,
  type ButtonProps,
  type ButtonVariant,
  type CardProps,
  type ChipProps,
  type ChipStatus,
  type ComponentFeedbackState,
  type DialogProps,
  type DrawerProps,
  type QuotePillProps,
} from './primitives';
export {
  lightfieldCssVariables,
  lightfieldTokens,
  type LightfieldColorToken,
  type LightfieldMotionToken,
  type LightfieldTokens,
} from './tokens';
export { formatUsdMicros } from './money';
