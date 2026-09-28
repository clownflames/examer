"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home,
  ListOrdered,
  Briefcase,
  Inbox,
  User,
} from "lucide-react";

const navItems = [
  { name: "HOME", href: "/", icon: Home },
  { name: "TIERLIST", href: "/tierlist", icon: ListOrdered },
  { name: "INTERNSHIPS", href: "/internships", icon: Briefcase },
  { name: "INBOX", href: "/inbox", icon: Inbox },
  { name: "PROFILE", href: "/profile", icon: User },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-0 left-0 right-0 z-50 
                 backdrop-blur-xl bg-black/60 border-t border-white/10
                 md:bg-black md:border-t md:border-white/10"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">

          {/* Left: Nav Items */}
          <div className="flex items-center justify-around md:justify-start md:gap-10 w-full md:w-auto">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="relative flex flex-col md:flex-row items-center gap-1 md:gap-2 
                             px-2 md:px-3 py-2 group"
                >
                  {/* Icon */}
                  <Icon
                    className={`w-5 h-5 md:w-5 md:h-5 transition-colors duration-300
                      ${isActive ? "text-primary" : "text-white/60 group-hover:text-white"}`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />

                  {/* Label */}
                  <span
                    className={`text-[10px] md:text-xs tracking-wider font-medium transition-colors duration-300
                      ${isActive ? "text-primary" : "text-white/60 group-hover:text-white"}`}
                  >
                    {item.name}
                  </span>

                  {/* Active Indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -top-[1px] md:top-auto md:-bottom-[1px] 
                                 left-1/2 md:left-0 -translate-x-1/2 md:translate-x-0
                                 h-[2px] w-6 md:w-full bg-primary rounded-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right: INTERNBIRD Logo (PC only) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="hidden md:flex items-center"
          >
            <div className="bg-primary text-black font-extrabold tracking-widest 
                            px-5 py-2.5 rounded-xl text-sm
                            shadow-[0_0_25px_-5px] shadow-primary/60
                            hover:scale-105 transition-transform duration-300">
              INTERNBIRD
            </div>
          </motion.div>

        </div>
      </div>
    </motion.nav>
  );
}