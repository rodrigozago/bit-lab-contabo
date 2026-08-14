/** Footer fixo das páginas de marketing do studio — mesmo espírito de
 * StudioNav.tsx (links hardcoded, sem story de config dedicada). */
export function StudioFooter() {
  return (
    <footer className="theme--dark border-border border-t">
      <div className="grid-12 py-16">
        <p className="text-label text-fg-muted col-span-12">
          bit-lab studio — parte do{" "}
          <a href="https://bit-lab.tech" className="underline">
            bit-lab.tech
          </a>
        </p>
        <p className="text-label text-fg-muted col-span-12 mt-4">
          © {new Date().getFullYear()} bit-lab
        </p>
      </div>
    </footer>
  );
}
