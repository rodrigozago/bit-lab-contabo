import Link from "next/link";

export default function NotFound() {
  return (
    <section className="theme--dark grid-12 min-h-screen items-center">
      <div className="col-span-12 text-center">
        <p className="text-label mb-6 text-accent">404</p>
        <h1 className="text-display">Não achamos essa página</h1>
        <Link
          href="/"
          className="text-label mt-10 inline-block border-b border-accent pb-1"
        >
          Voltar pro início
        </Link>
      </div>
    </section>
  );
}
