"use client";

import { useEffect, useRef, useState } from "react";

export function useNearViewport<T extends Element>(rootMargin = "360px") {
  const ref = useRef<T>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active) return undefined;
    const element = ref.current;
    if (!element) return undefined;
    if (!("IntersectionObserver" in window)) {
      const timer = globalThis.setTimeout(() => setActive(true), 0);
      return () => globalThis.clearTimeout(timer);
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setActive(true);
      observer.disconnect();
    }, { rootMargin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [active, rootMargin]);

  return { ref, active };
}
