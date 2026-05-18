import { motion } from "framer-motion";
import { UserPlus, ClipboardList, Users2, BarChart3, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const features = [
  { icon: ClipboardList, title: "Job Postings",       desc: "Publish open roles and share links directly with applicants." },
  { icon: Users2,        title: "Applicant Pipeline",  desc: "Track candidates from application through to offer in one board." },
  { icon: UserPlus,      title: "Interview Scheduling", desc: "Coordinate interviews and collect structured panel feedback." },
  { icon: BarChart3,     title: "Hiring Analytics",    desc: "Time-to-hire, offer acceptance rates, and source attribution." },
];

export default function Recruitment() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-4"
      >
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
          <UserPlus className="h-8 w-8 text-primary" strokeWidth={1.6} />
        </div>
        <h1 className="text-3xl font-display font-bold text-foreground">Recruitment</h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Hiring pipeline &amp; applicant tracking is coming soon.
          This module is in active development and will be available in a future release.
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
          Coming Soon
        </span>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
        {features.map(({ icon: Icon, title, desc }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07, duration: 0.3 }}
            className="flex gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Go back
      </Button>
    </div>
  );
}
