"use client";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gradient-to-r from-telkomsat-gray-lighter via-white to-telkomsat-gray-lighter bg-[length:400%_100%] ${className}`}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/40 bg-white/70 p-5 shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
          <Skeleton className="mt-4 h-8 w-20" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/70 shadow-lg backdrop-blur-md">
      <div className="border-b border-telkomsat-gray-lighter/60 p-4">
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="p-4 space-y-4">
        {Array.from({ length: rows }).map((_, rIndex) => (
          <div key={rIndex} className="flex items-center space-x-4">
            {Array.from({ length: cols }).map((_, cIndex) => (
              <Skeleton
                key={cIndex}
                className={`h-4 flex-1 ${cIndex === 0 ? "w-1/3" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
