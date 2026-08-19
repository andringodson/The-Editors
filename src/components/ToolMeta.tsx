import { CATEGORY_LABELS, TOOLS, toolOrdinal } from "@/lib/tools";

/**
 * The eyebrow above a tool's headline.
 *
 * Every panel on the reference site states what it is on the left and what it
 * is made of on the right; this is that device applied to a whole page. The
 * facts come from the tool registry rather than being retyped per page, so a
 * tool cannot end up describing itself two different ways.
 */
export default function ToolMeta({ slug }: { slug: string }) {
  const tool = TOOLS.find((candidate) => candidate.slug === slug);
  if (!tool) return null;

  return (
    <div className="eyebrow">
      <span>
        {CATEGORY_LABELS[tool.category]} <span className="sep">/</span> tool{" "}
        {toolOrdinal(tool)}
      </span>
      <span>
        {tool.clientSide ? "On device" : "Server assisted"}{" "}
        <span className="sep">/</span>{" "}
        {tool.clientSide ? "no upload" : "one request"}
      </span>
    </div>
  );
}
