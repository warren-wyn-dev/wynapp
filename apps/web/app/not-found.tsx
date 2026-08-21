import { EmptyState } from '@wyn/ui';
export default function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="The requested foundation route does not exist."
    />
  );
}
