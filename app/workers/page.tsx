import { getWorkers } from "@/lib/api";
import type { WorkerFleetDto } from "@/lib/api-types";
import { WorkersView } from "./workers-view";

export const revalidate = 0;

export default async function WorkersPage() {
  let fleet: WorkerFleetDto | null = null;
  let error: string | null = null;
  try {
    fleet = await getWorkers();
  } catch (e) {
    // An older QueryFlux without /admin/workers answers 404.
    error = e instanceof Error ? e.message : String(e);
  }
  return <WorkersView fleet={fleet} error={error} />;
}
