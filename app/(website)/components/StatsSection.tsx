"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Users, Trophy, Layers, Briefcase } from "lucide-react";
import { getHomeStats, type HomeStats } from "../actions";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Animated counter
function Counter({ target, duration = 1.5 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
      else setCount(target);
    };
    requestAnimationFrame(animate);
  }, [inView, target, duration]);

  return <span ref={ref}>{count.toLocaleString("en-IN")}</span>;
}

export default function StatsSection() {
  const [stats, setStats] = useState<HomeStats | null>(null);

  useEffect(() => {
    getHomeStats().then(setStats);
  }, []);

  const items = stats
    ? [
        { label: "Students", value: stats.students, icon: Users },
        { label: "Teams", value: stats.teams, icon: Trophy },
        { label: "Skill Demands", value: stats.demands, icon: Layers },
        { label: "Internships", value: stats.internships, icon: Briefcase },
      ]
    : [];

  return (
    <section className="w-full py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {!stats
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <Skeleton className="h-8 w-8 rounded-lg mb-3" />
                    <Skeleton className="h-7 w-16 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </CardContent>
                </Card>
              ))
            : items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                  >
                    <Card>
                      <CardContent className="p-5">
                        <Icon className="w-5 h-5 text-primary mb-3" />
                        <div className="text-2xl md:text-3xl font-bold">
                          <Counter target={item.value} />
                          <span className="text-primary">+</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.label}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
        </div>
      </div>
    </section>
  );
}