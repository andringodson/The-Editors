import AdSlot from "@/components/AdSlot";

/**
 * Shared chrome for every tool page.
 *
 * The ad sits *after* the tool, never above or inside it. Someone arriving to
 * compress a photo should reach the drop zone without scrolling past anything,
 * and a unit placed mid-flow would sit exactly where a misclick costs them
 * their work.
 */
export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <div className="mx-auto max-w-3xl px-4 pb-12">
        <AdSlot
          name="toolFooter"
          label="Advertisement — keeps these tools free"
        />
      </div>
    </>
  );
}
