"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowRight, Layers } from "lucide-react";
import { getFeaturedDemands, type DemandCard } from "../actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DemandDetailDrawer from "./DemandDetailDrawer";

export default function FeaturedDemandsSection() {
  const [demands, setDemands] = useState<DemandCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDemandId, setOpenDemandId] = useState<string | null>(null);

  useEffect(() => {
    getFeaturedDemands().then((res) => {
      setDemands(res);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <section className="w-full py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Card className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </Card>
        </div>
      </section>
    );
  }

  if (demands.length === 0) return null;

  return (
    <section className="w-full py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="flex flex-wrap items-end justify-between gap-4 mb-8"
        >
          <div>
            <Badge variant="outline" className="mb-3 gap-1.5">
              <Layers className="w-3 h-3" />
              CATEGORIES
            </Badge>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">
              Explore by <span className="text-primary">skill demand</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Pick a track that matches your interest — from fullstack to ML.
            </p>
          </div>
          <Button variant="outline" size="sm">
            View All
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
        >
          <Card className="overflow-hidden p-0">
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Demand</TableHead>
                    <TableHead>Key Skills</TableHead>
                    <TableHead className="text-right">Internships</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demands.map((d, i) => (
                    <motion.tr
                      key={d.id}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.4,
                        delay: i * 0.04,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      onClick={() => setOpenDemandId(d.id)}
                      className="cursor-pointer group"
                    >
                      {/* Demand */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {d.iconUrl ? (
                            <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                              <Image
                                src={d.iconUrl}
                                alt={d.name}
                                width={26}
                                height={26}
                                className="object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center shrink-0">
                              <Layers className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-sm font-semibold truncate max-w-[240px]">
                            {d.name}
                          </span>
                        </div>
                      </TableCell>

                      {/* Key features */}
                      <TableCell>
                        {d.keyFeatures.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {d.keyFeatures.slice(0, 4).map((f) => (
                              <Badge
                                key={f}
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {f}
                              </Badge>
                            ))}
                            {d.keyFeatures.length > 4 && (
                              <Badge
                                variant="outline"
                                className="text-[10px]"
                              >
                                +{d.keyFeatures.length - 4}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            —
                          </span>
                        )}
                      </TableCell>

                      {/* Internship count */}
                      <TableCell className="text-right">
                        <Badge variant="outline" className="gap-1.5">
                          {d.internshipCount} roles
                        </Badge>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden divide-y">
              {demands.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setOpenDemandId(d.id)}
                  className="w-full text-left px-4 py-3 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {d.iconUrl ? (
                      <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        <Image
                          src={d.iconUrl}
                          alt={d.name}
                          width={24}
                          height={24}
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold truncate">
                          {d.name}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[10px] shrink-0"
                        >
                          {d.internshipCount}
                        </Badge>
                      </div>
                      {d.keyFeatures.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {d.keyFeatures.slice(0, 3).map((f) => (
                            <Badge
                              key={f}
                              variant="secondary"
                              className="text-[9px]"
                            >
                              {f}
                            </Badge>
                          ))}
                          {d.keyFeatures.length > 3 && (
                            <Badge
                              variant="outline"
                              className="text-[9px]"
                            >
                              +{d.keyFeatures.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ============ DRAWER ============ */}
      <DemandDetailDrawer
        demandId={openDemandId}
        onClose={() => setOpenDemandId(null)}
      />
    </section>
  );
}