import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { ComponentType } from "react";

interface Props {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

export function ModulePlaceholder({ icon: Icon, title, description }: Props) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md text-center"
      >
        <div
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-border-strong bg-surface"
          style={{
            boxShadow:
              "inset 0 1px 0 color-mix(in oklch, white 6%, transparent), 0 20px 60px -20px color-mix(in oklch, var(--primary) 25%, transparent)",
          }}
        >
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <p className="mt-6 text-caption">Módulo em breve</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <a
          href="/calendar"
          className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-opacity hover:opacity-80"
        >
          Ir para o calendário
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </motion.div>
    </div>
  );
}
