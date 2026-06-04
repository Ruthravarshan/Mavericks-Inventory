import * as React from "react";
import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedListProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: React.ReactNode;
  stagger?: number;
  delay?: number;
}

const containerVariants = (stagger: number, delayChildren: number) => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function AnimatedList({
  children,
  stagger = 0.04,
  delay = 0,
  className,
  ...rest
}: AnimatedListProps) {
  return (
    <motion.div
      variants={containerVariants(stagger, delay)}
      initial="hidden"
      animate="show"
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedItemProps extends HTMLMotionProps<"div"> {
  asChild?: boolean;
}

export function AnimatedItem({ className, children, ...rest }: AnimatedItemProps) {
  return (
    <motion.div
      variants={itemVariants}
      className={cn(className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Animated table row that fades+slides on mount and lifts subtly on hover. */
export function AnimatedTableRow({
  index = 0,
  className,
  children,
  ...rest
}: HTMLMotionProps<"tr"> & { index?: number }) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.28,
        delay: Math.min(index * 0.02, 0.24),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ backgroundColor: "hsl(var(--secondary) / 0.45)" }}
      className={cn("transition-colors", className)}
      {...rest}
    >
      {children}
    </motion.tr>
  );
}

/** Slide / fade content between AnimatePresence keys. Useful for tab swaps. */
export function FadeSwap({
  k,
  children,
  className,
}: {
  k: string | number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={k}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
