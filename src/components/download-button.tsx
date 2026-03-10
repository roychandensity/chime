"use client";

import { useCallback } from "react";

interface DownloadButtonProps {
  targetRef: React.RefObject<HTMLDivElement | null>;
  filename: string;
}

export default function DownloadButton({ targetRef, filename }: DownloadButtonProps) {
  const handleDownload = useCallback(async () => {
    if (!targetRef.current) return;
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(targetRef.current, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
    });
    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();
  }, [targetRef, filename]);

  return (
    <button
      onClick={handleDownload}
      className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-100 transition-colors"
      title="Download as PNG"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </button>
  );
}
