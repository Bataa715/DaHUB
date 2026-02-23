"use client";

import { memo, useState, useEffect, ComponentType } from "react";
import { LucideProps } from "lucide-react";

interface DynamicIconProps extends LucideProps {
  name: string;
  fallback?: React.ReactNode;
}

// Cache for dynamically loaded icons
const iconCache = new Map<string, ComponentType<LucideProps>>();

const DynamicIcon = memo(
  ({ name, fallback = null, ...props }: DynamicIconProps) => {
    const [Icon, setIcon] = useState<ComponentType<LucideProps> | null>(() => {
      return iconCache.get(name) || null;
    });
    const [loading, setLoading] = useState(!iconCache.has(name));

    useEffect(() => {
      if (!name) return;

      // Check cache first
      if (iconCache.has(name)) {
        setIcon(() => iconCache.get(name)!);
        setLoading(false);
        return;
      }

      // Dynamically import the icon
      import("lucide-react")
        .then((mod) => {
          const LoadedIcon = (mod as any)[name];
          if (LoadedIcon) {
            iconCache.set(name, LoadedIcon);
            setIcon(() => LoadedIcon);
          }
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }, [name]);

    if (!name) return null;

    if (loading) {
      return <span className="w-5 h-5 animate-pulse bg-muted rounded" />;
    }

    if (!Icon) {
      return <>{fallback}</>;
    }

    return <Icon {...props} />;
  },
);

DynamicIcon.displayName = "DynamicIcon";

export default DynamicIcon;
