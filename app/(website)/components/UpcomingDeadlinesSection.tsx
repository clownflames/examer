"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Clock, Flame, ArrowUpRight } from "lucide-react";
import { getUpcomingDeadlines, type UpcomingInternship } from "../actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function urgencyStyle(days: number) {
  if (days <= 2)
    return {
      badge: "destructive" as const,
      text: "text-red-400",
      label: `${days}d left`,
    };
  if (days <= 7)
    return {
      badge: "secondary" as const,
      text: "text-amber-400",
      label: `${days}d left`,
    };
  return {
    badge: "outline" as const,
    text: "text-muted-foreground",
    label: `${days}d left`,
  };
}

export default function UpcomingDeadlinesSection() {
  const [items, setItems] = useState<UpcomingInternship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUpcomingDeadlines().then((res) => {
      setItems(res);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <section className="w-full py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="w-full py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <Badge variant="outline" className="mb-3 gap-1.5">
            <Flame className="w-3 h-3" />
            CLOSING SOON
          </Badge>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">
            Don't miss these <span className="text-primary">deadlines</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, i) => {
            const u = urgencyStyle(item.daysLeft);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <Card className="h-full hover:border-primary/40 transition-colors group cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {item.demandIconUrl ? (
                          <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            <Image
                              src={item.demandIconUrl}
                              alt={item.demandName ?? ""}
                              width={24}
                              height={24}
                              className="object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold truncate">
                            {item.name}
                          </h3>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {item.demandName}
                          </p>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </div>

                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <Badge variant={u.badge} className="gap-1.5">
                        <Clock className="w-3 h-3" />
                        {u.label}
                      </Badge>
                      {item.sellingPrice && Number(item.sellingPrice) > 0 && (
                        <span className="text-xs font-bold text-primary">
                          ₹{Number(item.sellingPrice).toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
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