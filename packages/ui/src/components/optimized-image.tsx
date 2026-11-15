'use client'

/**
 * OPTIMIZED IMAGE COMPONENT
 * ==========================
 * Next.js Image with aggressive optimizations for mobile
 * 
 * Features:
 * - Automatic WebP conversion
 * - Lazy loading by default
 * - Responsive sizes
 * - Blur placeholder
 * - Priority loading for above-fold images
 */

import Image from 'next/image'
import { useState } from 'react'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
  className?: string
  fill?: boolean
  sizes?: string
  quality?: number
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className = '',
  fill = false,
  sizes,
  quality = 85
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        fill={fill}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        placeholder="blur"
        blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlMmU4ZjAiLz48L3N2Zz4="
        sizes={sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
        quality={quality}
        className={`
          duration-700 ease-in-out
          ${isLoading ? 'scale-110 blur-sm' : 'scale-100 blur-0'}
        `}
        onLoadingComplete={() => setIsLoading(false)}
      />
    </div>
  )
}

/**
 * LAZY SECTION COMPONENT
 * =======================
 * Lazy load entire sections for better performance
 */

import { useEffect, useRef } from 'react'

interface LazySectionProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  rootMargin?: string
  threshold?: number
}

export function LazySection({ 
  children, 
  fallback,
  rootMargin = '100px',
  threshold = 0.1
}: LazySectionProps) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin, threshold }
    )
    
    if (ref.current) {
      observer.observe(ref.current)
    }
    
    return () => observer.disconnect()
  }, [rootMargin, threshold])
  
  return (
    <div ref={ref}>
      {isVisible ? children : (
        fallback || <div className="h-64 bg-slate-100 animate-pulse rounded-lg" />
      )}
    </div>
  )
}

/**
 * PERFORMANCE MONITORING
 * ======================
 * Track image load performance
 */

export function useImagePerformance(imageSrc: string) {
  useEffect(() => {
    const img = new window.Image()
    const startTime = performance.now()
    
    img.onload = () => {
      const loadTime = performance.now() - startTime
      
      // Track to analytics
      fetch('/api/analytics/image-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          src: imageSrc,
          load_time_ms: Math.round(loadTime),
          timestamp: new Date().toISOString()
        })
      }).catch(console.error)
    }
    
    img.src = imageSrc
  }, [imageSrc])
}

