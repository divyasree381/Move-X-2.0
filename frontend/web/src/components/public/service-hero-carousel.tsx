"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bike,
  Clock3,
  Home,
  Package,
  Pill,
  ShoppingBasket,
  Sparkles,
  Utensils,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui";
import type { PublicHeroSlide } from "@/lib/public-site-data";
import { cn } from "@/lib/utils";

const SLIDE_DURATION_MS = 6000;
const serviceIcons: Record<PublicHeroSlide["id"], LucideIcon> = {
  food: Utensils,
  grocery: ShoppingBasket,
  pharmacy: Pill,
  rides: Bike,
  courier: Package,
  home: Home,
};

export function ServiceHeroCarousel({ slides }: { slides: PublicHeroSlide[] }) {
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const paused = hoverPaused || focusPaused;
  const activeSlide = slides[activeIndex] ?? slides[0];

  useEffect(() => {
    if (reducedMotion || !autoPlay || paused || slides.length < 2) return;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % slides.length), SLIDE_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [autoPlay, paused, reducedMotion, slides.length]);

  if (!activeSlide) return null;

  function selectSlide(index: number) {
    setActiveIndex(index);
    setAutoPlay(false);
  }

  function moveSlide(direction: -1 | 1) {
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
    setAutoPlay(false);
  }

  const Icon = serviceIcons[activeSlide.id];

  return (
    <section
      className="relative isolate min-h-[34rem] overflow-hidden bg-foreground text-white lg:min-h-[36rem]"
      aria-roledescription="carousel"
      aria-label="MoveX services"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusPaused(false);
      }}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={activeSlide.id}
          className="absolute inset-0"
          initial={reducedMotion ? false : { opacity: 0, scale: 1.015 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.6, ease: "easeInOut" }}
        >
          <Image
            src={activeSlide.imageUrl}
            alt={activeSlide.imageAlt}
            fill
            unoptimized
            priority={activeIndex === 0}
            sizes="100vw"
            className="object-cover object-center"
          />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.86)_0%,rgba(2,6,23,0.68)_46%,rgba(2,6,23,0.18)_100%)]" aria-hidden="true" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.32)_0%,rgba(2,6,23,0)_42%,rgba(2,6,23,0.45)_100%)]" aria-hidden="true" />

      <motion.div
        className="relative mx-auto flex min-h-[34rem] max-w-7xl touch-pan-y items-center px-4 pb-28 pt-16 sm:px-6 sm:pb-28 sm:pt-20 lg:min-h-[36rem] lg:px-8"
        drag={reducedMotion ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.08}
        onDragEnd={(_, info) => {
          if (info.offset.x < -70) moveSlide(1);
          if (info.offset.x > 70) moveSlide(-1);
        }}
      >
        <div className="w-full max-w-3xl" aria-live={autoPlay ? "off" : "polite"} aria-atomic="true">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${activeSlide.id}-content`}
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md">
                <Icon className="size-4 text-accent" aria-hidden="true" />
                {activeSlide.eyebrow}
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-medium leading-[1.05] text-white sm:text-5xl lg:text-6xl">{activeSlide.title}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">{activeSlide.description}</p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="min-h-12 px-6">
                  <Link href={activeSlide.href}>{activeSlide.ctaLabel}<ArrowRight className="size-4" aria-hidden="true" /></Link>
                </Button>
                <span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/20 bg-black/20 px-4 text-sm font-medium text-white/88 backdrop-blur-md">
                  <Clock3 className="size-4 text-accent" aria-hidden="true" />{activeSlide.promise}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3" role="tablist" aria-label="Choose a MoveX service">
        {slides.map((slide, index) => {
          const selected = index === activeIndex;
          return (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={`Go to slide ${index + 1}: ${slide.label}`}
              className={cn(
                "block h-2.5 rounded-full transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
                selected ? "w-8 bg-primary" : "w-2.5 bg-white/50 hover:bg-white/80"
              )}
              onClick={() => selectSlide(index)}
            />
          );
        })}
      </div>

      <div className="sr-only"><Sparkles aria-hidden="true" />Slide {activeIndex + 1} of {slides.length}: {activeSlide.label}</div>
    </section>
  );
}
