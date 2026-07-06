/** Generic content skeleton shown while a route loader is pending. Renders a
 *  shimmering bento layout that matches the app's panel rhythm. */
function Bar({ w = "100%", h = 12 }: { w?: string; h?: number }) {
  return <div className="rounded-md bg-white/[0.06]" style={{ width: w, height: h }} />;
}

function PanelSkeleton({ className = "", lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={`panel p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <Bar w="120px" h={14} />
        <Bar w="48px" h={14} />
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Bar key={i} w={`${90 - i * 12}%`} h={12} />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-12 gap-4 xl:gap-5">
        <div className="col-span-12 xl:col-span-8 panel-neon p-7">
          <Bar w="140px" h={14} />
          <div className="mt-5"><Bar w="240px" h={40} /></div>
          <div className="mt-6 h-28 rounded-xl bg-white/[0.04]" />
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        </div>
        <PanelSkeleton className="col-span-12 xl:col-span-4" lines={5} />
        <PanelSkeleton className="col-span-12 xl:col-span-7" lines={4} />
        <PanelSkeleton className="col-span-12 xl:col-span-5" lines={4} />
      </div>
    </div>
  );
}
