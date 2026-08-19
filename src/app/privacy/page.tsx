export const metadata = {
  title: "Privacy & ads",
  description:
    "What happens to your files, what the ads collect, and where the line between the two sits.",
};

export default function PrivacyPage() {
  return (
    <div className="shell-prose bleed py-[var(--space-l)]">
      <div className="eyebrow">
        <span>
          Privacy <span className="sep">/</span> advertising
        </span>
        <span>
          Plain english <span className="sep">/</span> no lawyers
        </span>
      </div>
      <h1 className="headline-sm">Privacy &amp; ads</h1>
      <p className="mt-3 text-muted text-pretty">
        This site is free because it shows advertising. That is worth being
        precise about, because &ldquo;we don&apos;t upload your files&rdquo; and
        &ldquo;we don&apos;t collect anything&rdquo; are different claims and
        only the first one is true.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Your files</h2>
        <p className="mt-[var(--space-2xs)] text-muted text-pretty">
          Every tool except Office→PDF runs entirely inside your browser.
          Cropping, compressing, passport photos, PDF merging — the file is read
          by your own machine, processed there, and handed back. It is never
          uploaded, never stored, and never seen by us. You can verify this by
          disconnecting from the internet: the tools keep working.
        </p>
        <p className="mt-3 text-muted text-pretty">
          <strong className="text-foreground">
            Office→PDF is the exception.
          </strong>{" "}
          Converting PowerPoint, Word and Excel needs LibreOffice, which cannot
          run in a browser, so that file is sent to our converter. It is deleted
          as soon as the PDF comes back — nothing is written to disk beyond the
          moments the conversion takes.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">The ads</h2>
        <p className="mt-[var(--space-2xs)] text-muted text-pretty">
          Advertising is served by Google AdSense. Google sets cookies and
          collects data about your visit — the pages you view, your approximate
          location, your device. That is Google&apos;s collection, under
          Google&apos;s policy, and we do not receive or control it.
        </p>
        <p className="mt-3 text-muted text-pretty">
          Ads are{" "}
          <strong className="text-foreground">
            non-personalised by default
          </strong>
          . Unless you have explicitly agreed, they are chosen from the page you
          are on rather than a profile of you. You were asked once; you can
          change your mind by clearing this site&apos;s data in your browser.
        </p>
        <p className="mt-3 text-muted text-pretty">
          Your files are never part of this. Ad code cannot reach them — it runs
          in a separate frame and the page&apos;s security policy blocks it from
          sending data anywhere but Google&apos;s own ad servers.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">What we collect</h2>
        <p className="mt-[var(--space-2xs)] text-muted text-pretty">
          We record which tool ran, how big the input and output were, how long
          it took, and whether it worked. That tells us which tools are slow or
          failing. It does not include filenames or file contents, and there is
          nothing in it that identifies you unless you are signed in.
        </p>
        <p className="mt-3 text-muted text-pretty">
          If you have an account, we store your email address so you can sign in
          and so Office→PDF can be metered. That is all.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Why an account for Office→PDF</h2>
        <p className="mt-[var(--space-2xs)] text-muted text-pretty">
          It is the only tool that runs on hardware we pay for. Without knowing
          who is asking, there is no way to stop one visitor consuming the whole
          budget — so it is capped per account per day. Every other tool stays
          anonymous, because every other tool costs us nothing.
        </p>
      </section>
    </div>
  );
}
