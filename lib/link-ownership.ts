import { Resource, ResourceMetaValue } from "@/lib/types";

export type LinkOwner = "own" | "external";

function readMetaString(meta: Record<string, ResourceMetaValue> | undefined, key: string) {
  const value = meta?.[key];
  return typeof value === "string" ? value : "";
}

export function inferResourceLinkOwner(
  resource: Pick<Resource, "id" | "quark_url" | "meta">
): LinkOwner {
  const explicitOwner = readMetaString(resource.meta, "link_owner");
  if (explicitOwner === "own" || explicitOwner === "external") {
    return explicitOwner;
  }

  const source = readMetaString(resource.meta, "source");
  const sourceGroupId = readMetaString(resource.meta, "source_group_id");
  const sourceGroupPath = readMetaString(resource.meta, "source_group_path");

  if (resource.id.startsWith("k12grp_") || sourceGroupId || sourceGroupPath) {
    return "own";
  }

  if (
    resource.id.startsWith("res52soft_") ||
    resource.id.startsWith("res_gaok") ||
    resource.id.startsWith("res_zhon") ||
    source === "52wei"
  ) {
    return "external";
  }

  return "external";
}

export function getLinkOwnerLabel(owner: LinkOwner) {
  return owner === "own" ? "我的网盘" : "外部链接";
}
