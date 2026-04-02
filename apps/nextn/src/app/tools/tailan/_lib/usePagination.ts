"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

/**
 * A4 хуудсанд контентыг хуваах pagination hook.
 *
 * Контент div-ийн шууд child элемент бүрийн байрлалыг тооцож,
 * хуудасны хилийг давсан элементийг дараагийн хуудасны эхэнд шилжүүлнэ.
 *
 * Background gradient-ийн cycle:  pageH + gapH  (жнэ 297mm + 20px)
 * Контент нэг хуудсанд:  pageH - padTop - padBottom
 *
 * Контент div нь position:relative, padding: padTop padRight padBottom padLeft.
 * child.offsetTop нь div-ийн border-top-аас тоологдоно → эхний child ≈ padTop.
 *
 * Хуудас 0 контент бүс:  padTop  →  pageH - padBottom
 * Хуудас 1 контент бүс:  pageH + gapH + padTop  →  2*pageH + gapH - padBottom
 * Хуудас n контент бүс:  n*(pageH+gapH) + padTop  →  (n+1)*pageH + n*gapH - padBottom
 */
export function usePagination(
  contentRef: RefObject<HTMLDivElement | null>,
  /** A4 хуудасны нийт өндөр px (297mm) */
  pageHeightPx: number,
  /** Хуудас хоорондын харагдах зай px (grey gap) */
  gapPx: number,
  /** Дээд padding px */
  padTopPx: number,
  /** Доод padding px */
  padBottomPx: number,
) {
  const rafId = useRef(0);
  const isRunning = useRef(false);

  const paginate = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;

    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      if (isRunning.current) return;
      isRunning.current = true;

      try {
        // 1. Урьд нэмсэн spacer margin-уудыг бүгдийг цэвэрлэх
        const marked = el.querySelectorAll("[data-pg-spacer]");
        marked.forEach((node) => {
          const h = node as HTMLElement;
          h.style.marginTop = h.dataset.pgOrigMt ?? "";
          delete h.dataset.pgSpacer;
          delete h.dataset.pgOrigMt;
        });

        // Force reflow after clearing
        void el.offsetHeight;

        // 2. Хэмжилт хийж spacer нэмэх
        const slot = pageHeightPx + gapPx;
        const contentH = pageHeightPx - padTopPx - padBottomPx;
        const contentBottom = pageHeightPx - padBottomPx;

        /**
         * Элементийн el-ийн border-top-аас хэмжсэн абсолют offsetTop тооцох.
         * position:relative бүхий offsetParent chain-ийг дагаж нэмнэ.
         */
        const absTop = (node: HTMLElement): number => {
          let t = 0;
          let cur: HTMLElement | null = node;
          while (cur && cur !== el) {
            t += cur.offsetTop;
            cur = cur.offsetParent as HTMLElement | null;
          }
          return t;
        };

        const processChildren = (parent: HTMLElement, depth: number) => {
          const children = parent.children;
          for (let i = 0; i < children.length; i++) {
            const child = children[i] as HTMLElement;
            const h = child.offsetHeight;
            if (!h) continue;

            // el-ийн border-top-аас хэмжсэн абсолют offset
            const top = absTop(child);
            const bottom = top + h;

            const pageIdx = Math.floor(top / slot);
            const pageContentEnd = pageIdx * slot + contentBottom;

            if (bottom > pageContentEnd && top < pageContentEnd) {
              // Элемент нэг хуудасны контент зайд багтаж чадах уу?
              if (h <= contentH || depth >= 3 || child.children.length === 0) {
                // Бүтэн зөөх — дараагийн хуудасны эхлэл рүү
                const nextPageContentStart = (pageIdx + 1) * slot + padTopPx;
                const spacer = nextPageContentStart - top;

                child.dataset.pgOrigMt = child.style.marginTop;
                child.dataset.pgSpacer = "1";
                const existing = parseFloat(getComputedStyle(child).marginTop) || 0;
                child.style.marginTop = `${existing + spacer}px`;

                void el.offsetHeight;
              } else {
                // Элемент нэг хуудаснаас том → дотор child-уудыг шалгах
                processChildren(child, depth + 1);
              }
            }
          }
        };

        processChildren(el, 0);
      } finally {
        isRunning.current = false;
      }
    });
  }, [contentRef, pageHeightPx, gapPx, padTopPx, padBottomPx]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    // Эхний тооцоо — жаахан хүлээх (DOM бэлэн болтол)
    const timer = setTimeout(paginate, 60);

    // Контент өөрчлөгдөх бүрт дахин тооцох
    const debouncedPaginate = debounce(paginate, 100);

    const mo = new MutationObserver(debouncedPaginate);
    mo.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["style"] });

    const ro = new ResizeObserver(debouncedPaginate);
    ro.observe(el);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafId.current);
      mo.disconnect();
      ro.disconnect();
    };
  }, [contentRef, paginate]);
}

function debounce(fn: () => void, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}

/**
 * mm → px хөрвүүлэх (96 DPI стандарт)
 */
export function mmToPx(mm: number): number {
  return mm * 96 / 25.4;
}
