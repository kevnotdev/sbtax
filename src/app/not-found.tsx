import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ground p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">This page doesn’t exist</h1>
      <p className="text-sub">The link may be old, or the address was mistyped.</p>
      <Link
        href="/"
        className="mt-2 inline-flex h-11 items-center rounded-[10px] bg-spruce-900 px-5 font-medium text-white transition-colors hover:bg-spruce-800"
      >
        Back to your return
      </Link>
    </main>
  );
}
