/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // We don't ship an ESLint config in the MVP; type-checking is the gate.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      // Vercel Blob public URLs for survey photos.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
