import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  serverExternalPackages: ['@react-pdf/renderer', 'docx', 'file-saver', 'pdfjs-dist'],
};

export default nextConfig;
