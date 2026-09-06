import { redirect } from "next/navigation";
import { PANELS } from "./panels";

export default function ProfilePage() {
  redirect(`/profile/${Object.keys(PANELS)[0]}`);
}
