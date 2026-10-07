import { CheesePoster } from "@/components/cheese-poster";
import { isLocalHostname } from "@/lib/host";
import { headers } from "next/headers";

export default async function Home() {
  const headerList = await headers();
  const localMachine = isLocalHostname(headerList.get("host"));
  return <CheesePoster localMachine={localMachine} />;
}
