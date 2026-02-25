"use client";

import { useState, useEffect } from "react";

interface BlobImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

/**
 * Renders a base64 data-URL image via a blob: URL to avoid
 * large inline data URIs being embedded in the DOM.
 */
export default function BlobImage({ src, alt, ...props }: BlobImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    let url: string | null = null;
    fetch(src)
      .then((r) => r.blob())
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch(() => setBlobUrl(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  if (!blobUrl) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={blobUrl} alt={alt} {...props} />;
}
