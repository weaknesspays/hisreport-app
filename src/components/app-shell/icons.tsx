import {
  Activity, Ambulance, BedDouble, Building2, ClipboardCheck, FileBarChart, Folder, HeartPulse, Pill, Repeat,
  Stethoscope, Syringe, TestTube, Users, Baby, Brain, type LucideIcon,
} from "lucide-react";

// ไอคอนที่เลือกได้สำหรับหัวข้อรายงาน (เก็บเป็นชื่อใน report_group.icon)
export const GROUP_ICONS: Record<string, LucideIcon> = {
  folder: Folder,
  chart: FileBarChart,
  opd: Stethoscope,
  ipd: BedDouble,
  er: Ambulance,
  ncd: HeartPulse,
  refer: Repeat,
  quality: ClipboardCheck,
  drug: Pill,
  vaccine: Syringe,
  lab: TestTube,
  people: Users,
  mch: Baby,
  psych: Brain,
  activity: Activity,
  org: Building2,
};

export function GroupIcon({ name, className }: { name: string; className?: string }) {
  const I = GROUP_ICONS[name] ?? Folder;
  return <I className={className} />;
}
