export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}
