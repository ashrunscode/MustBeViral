import { Card, Chip, MonoCaps } from '@mustbeviral/ui';

export function WorkflowPlaceholder({ name }: Readonly<{ name: string }>) {
  return (
    <main id="main-content" className="workflow-placeholder">
      <Card className="workflow-placeholder__card">
        <Chip status="queued">Authorized placeholder</Chip>
        <MonoCaps>Lumen Skin / P0 workflow</MonoCaps>
        <h1>{name}</h1>
        <p>
          This route is wired into the authenticated studio shell and will be implemented in its
          packet step.
        </p>
      </Card>
    </main>
  );
}
