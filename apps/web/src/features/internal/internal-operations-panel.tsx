import { PlatformEmptySection, PlatformHeading } from '../platform/platform-frame';

/**
 * There is no accepted platform-operator grant or operations query yet. Workspace membership is
 * not that grant. Keep this surface closed before mounting data readers or browser subscriptions.
 */
export function InternalOperationsPanel() {
  return (
    <div className="platform-stack platform-operations">
      <PlatformHeading
        title="Operations"
        description="Operations access is unavailable. No operations data is loaded or changed."
      />
      <PlatformEmptySection
        title="Operations access is unavailable."
        body="Signing in to a workspace does not grant access to platform operations. Your saved work stays saved."
        missing="This release has no approved operator permission or operations query."
        action={{ href: '/studio', label: 'Return to your studios' }}
      />
    </div>
  );
}
