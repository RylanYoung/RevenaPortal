import { redirect } from "next/navigation";

/**
 * Root goes to the client portal — clients are who'll actually land here from
 * a link. Admin is reached directly at /admin.
 */
export default function Home() {
  redirect("/portal");
}
