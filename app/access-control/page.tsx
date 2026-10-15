import { getAccessControlConfig, listGroupConfigs } from "@/lib/api";
import { AccessControlEditor } from "./access-control-editor";

export const revalidate = 0;

export default async function AccessControlPage() {
  const [config, groupConfigs] = await Promise.all([
    getAccessControlConfig().catch(() => null),
    listGroupConfigs().catch(() => []),
  ]);
  const groups = groupConfigs.map((g) => g.name).sort();
  return <AccessControlEditor initialConfig={config} clusterGroups={groups} />;
}
