import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FBFBFD] flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 text-6xl font-black text-gray-200 select-none">404</div>
      <h1 className="text-2xl font-black text-gray-900 mb-3">Page not found</h1>
      <p className="text-gray-500 text-sm mb-8 max-w-xs">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gray-900 rounded-full hover:scale-105 active:scale-95 transition-all shadow-md"
      >
        Back to home
      </Link>
    </div>
  );
}
