"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Clock3,
  Home,
  Package,
  Pause,
  Pill,
  Play,
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
          transition={{ duration: reducedMotion ? 0 : 0.55, ease: "easeOut" }}
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
              transition={{ duration: reducedMotion ? 0 : 0.34, ease: "easeOut" }}
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

      <div className="absolute inset-x-0 bottom-16 z-10">
        <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Choose a MoveX service">
            {slides.map((slide, index) => {
              const SlideIcon = serviceIcons[slide.id];
              const selected = index === activeIndex;
              return (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={cn(
                    "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45",
                    selected ? "border-white bg-white text-foreground" : "border-white/20 bg-black/25 text-white/82 hover:bg-black/40",
                  )}
                  onClick={() => selectSlide(index)}
                >
                  <SlideIcon className="size-3.5" aria-hidden="true" />{slide.label}
                </button>
              );
            })}
          </div>

          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <IconButton label="Previous service" onClick={() => moveSlide(-1)}><ArrowLeft className="size-4" aria-hidden="true" /></IconButton>
            <IconButton label={autoPlay ? "Pause slideshow" : "Resume slideshow"} onClick={() => { setAutoPlay((current) => !current); setHoverPaused(false); }}>{autoPlay ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}</IconButton>
            <IconButton label="Next service" onClick={() => moveSlide(1)}><ArrowRight className="size-4" aria-hidden="true" /></IconButton>
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 sm:hidden">
        <IconButton label="Previous service" onClick={() => moveSlide(-1)}><ArrowLeft className="size-4" aria-hidden="true" /></IconButton>
        <button type="button" className="grid size-9 place-items-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-md" aria-label={autoPlay ? "Pause slideshow" : "Resume slideshow"} onClick={() => { setAutoPlay((current) => !current); setHoverPaused(false); }}>{autoPlay ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}</button>
        <IconButton label="Next service" onClick={() => moveSlide(1)}><ArrowRight className="size-4" aria-hidden="true" /></IconButton>
      </div>

      <div className="sr-only"><Sparkles aria-hidden="true" />Slide {activeIndex + 1} of {slides.length}: {activeSlide.label}</div>
    </section>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} className="grid size-9 place-items-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-md transition hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45" onClick={onClick}>{children}</button>;
}