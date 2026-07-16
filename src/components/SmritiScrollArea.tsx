/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect, useRef } from "react";

interface SmritiScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  maxHeight?: string | number;
  fadeColorClass?: string; // e.g. "from-[#16213e]", matches parent card background
}

export const SmritiScrollArea: React.FC<SmritiScrollAreaProps> = ({
  children,
  className = "",
  style,
  maxHeight,
  fadeColorClass = "from-[#16213e]" // Default SMRITI Surface color
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Layout state
  const [scrollHeight, setScrollHeight] = useState(0);
  const [clientHeight, setClientHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // Interactive state
  const [isHovered, setIsHovered] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragStartRef = useRef<{ y: number; scrollTop: number } | null>(null);

  // Recalculate dimensions
  const updateDimensions = () => {
    const viewport = viewportRef.current;
    if (viewport) {
      setScrollHeight(viewport.scrollHeight);
      setClientHeight(viewport.clientHeight);
      setScrollTop(viewport.scrollTop);
    }
  };

  // Setup ResizeObserver to watch for layout/content size changes
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    resizeObserver.observe(viewport);
    
    // Also observe children to react to content expansions
    const childrenContainer = viewport.firstElementChild;
    if (childrenContainer) {
      resizeObserver.observe(childrenContainer);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [children]);

  // Handle scrolling
  const handleScroll = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    setScrollTop(viewport.scrollTop);

    // Show scrollbar thumb during active scrolling
    setIsScrolling(true);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1200); // Fade out 1.2s after scrolling stops
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Proportional scrollbar thumb metrics
  const hasScrollbar = scrollHeight > clientHeight;
  const scrollableHeight = scrollHeight - clientHeight;
  
  // Calculate proportional thumb height (min 32px so it's always easy to grab)
  const thumbHeight = hasScrollbar
    ? Math.max((clientHeight / scrollHeight) * clientHeight, 32)
    : 0;

  // Calculate top offset for the thumb within the track
  const trackSpace = clientHeight - thumbHeight;
  const thumbTop = scrollableHeight > 0
    ? (scrollTop / scrollableHeight) * trackSpace
    : 0;

  // Drag handlers
  const handleThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const viewport = viewportRef.current;
    if (!viewport) return;

    setIsDragging(true);
    dragStartRef.current = {
      y: e.clientY,
      scrollTop: viewport.scrollTop
    };

    document.addEventListener("mousemove", handleDocumentMouseMove);
    document.addEventListener("mouseup", handleDocumentMouseUp);
  };

  const handleDocumentMouseMove = (e: MouseEvent) => {
    if (!dragStartRef.current || !viewportRef.current) return;
    
    const viewport = viewportRef.current;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    // Convert track movement to actual scroll delta
    const ratio = scrollableHeight / trackSpace;
    viewport.scrollTop = dragStartRef.current.scrollTop + deltaY * ratio;
  };

  const handleDocumentMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
    document.removeEventListener("mousemove", handleDocumentMouseMove);
    document.removeEventListener("mouseup", handleDocumentMouseUp);
  };

  // Keyboard accessibility and focus handler
  const handleContainerFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    // If focus is within the scroll container, show scrollbar temporarily
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1500);
  };

  // Top/bottom gradient fade opacity
  const showTopFade = hasScrollbar && scrollTop > 4;
  const showBottomFade = hasScrollbar && scrollTop < scrollableHeight - 4;

  const containerStyle: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    maxHeight: maxHeight,
    ...style
  };

  // Translate background color class to opposite gradient endpoint
  // e.g. from-[#16213e] => to-transparent
  const topFadeClass = `smriti-scroll-indicator smriti-scroll-indicator-top bg-gradient-to-b ${fadeColorClass} to-transparent`;
  const bottomFadeClass = `smriti-scroll-indicator smriti-scroll-indicator-bottom bg-gradient-to-t ${fadeColorClass} to-transparent`;

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col group/scroll ${className}`}
      style={containerStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={handleContainerFocus}
    >
      {/* Top Gradient Indicator */}
      <div
        className={topFadeClass}
        style={{ opacity: showTopFade ? 1 : 0 }}
      />

      {/* Main Viewport Container */}
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        className="w-full h-full overflow-y-auto smriti-hide-scrollbar smriti-smooth-scroll flex-1 select-text"
        tabIndex={0} // Ensure scroll container is keyboard focusable
      >
        <div className="w-full min-h-full">
          {children}
        </div>
      </div>

      {/* Bottom Gradient Indicator */}
      <div
        className={bottomFadeClass}
        style={{ opacity: showBottomFade ? 1 : 0 }}
      />

      {/* Reusable Custom Overlay Scrollbar Track & Thumb */}
      {hasScrollbar && (
        <div 
          className="absolute right-0.5 top-1 bottom-1 w-2 z-30 pointer-events-none"
        >
          <div
            onMouseDown={handleThumbMouseDown}
            className="smriti-scroll-thumb-active w-1.5 rounded-full cursor-pointer pointer-events-auto bg-blue-500/30 hover:bg-blue-500/60 active:bg-blue-500/85"
            style={{
              height: `${thumbHeight}px`,
              transform: `translateY(${thumbTop}px)`,
              opacity: isHovered || isScrolling || isDragging ? 1 : 0,
              position: "absolute",
              right: 0
            }}
          />
        </div>
      )}
    </div>
  );
};
