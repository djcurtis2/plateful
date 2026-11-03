import { contactEmail } from "@/lib/env";

/** "Questions? Email us" line for the legal pages. Renders nothing until a contact address is configured. */
export function ContactLine({ about = "anything here" }: { about?: string }) {
  if (!contactEmail) return null;
  return (
    <p className="text-muted">
      Questions about {about}? Email{" "}
      <a href={`mailto:${contactEmail}`} className="font-medium text-ink underline">
        {contactEmail}
      </a>
      .
    </p>
  );
}
