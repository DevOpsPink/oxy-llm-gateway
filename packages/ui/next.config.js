/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hosts the dev server answers besides localhost (the devcontainer's proxy
  // origin in Codespaces); comma-separated, from .devcontainer/start.sh.
  allowedDevOrigins: (process.env.NEXT_ALLOWED_DEV_ORIGINS || '').split(',').map((h) => h.trim()).filter(Boolean),

  // ============================================================================
  // PERFORMANCE OPTIMIZATIONS
  // ============================================================================
  
  // Optimize CSS (inline critical CSS, remove unused)
  experimental: {
    optimizeCss: true,
    
    // Tree-shake large UI libraries (only import used components)
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip'
    ]
  },
  
  // Code splitting configuration
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Optimize client-side bundle splitting
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Vendor chunk (node_modules)
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
              reuseExistingChunk: true
            },
            // UI components chunk
            ui: {
              test: /[\\/]src[\\/]components[\\/]ui[\\/]/,
              name: 'ui',
              priority: 9,
              reuseExistingChunk: true
            },
            // Common shared code
            common: {
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true
            }
          }
        }
      }
    }
    return config
  },
  
  // ============================================================================
  // IMAGE OPTIMIZATION
  // ============================================================================
  
  images: {
    formats: ['image/avif', 'image/webp'], // Modern formats
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]
  },
  
  // ============================================================================
  // COMPRESSION
  // ============================================================================
  
  compress: true, // Enable gzip compression
  
  // ============================================================================
  // PRODUCTION OPTIMIZATIONS
  // ============================================================================
  
  // Note: swcMinify is enabled by default in Next.js 13+ (deprecated in Next.js 16)
  
  // Remove console.log in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false
  },
  
  // ============================================================================
  // HEADERS & CACHING
  // ============================================================================
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      },
      // Cache static assets aggressively
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ]
  }
}

export default nextConfig

