import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  FolderArchive, Folder, FileText, Image as ImageIcon, FileArchive,
  FileCode2, Database, Upload, Download, Grid3x3, List, MoreVertical,
} from "lucide-react";
import { useState } from "react";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/files")({
  head: () => ({
    meta: [
      { title: "File Manager — ABANCOOL Command Center" },
      { name: "description", content: "Cloud file storage with previews and sharing" },
    ],
  }),
  component: FilesPage,
});

const items = [
  { type: "folder", name: "Client Backups", size: "—", mod: "2h", count: 124 },
  { type: "folder", name: "APK Releases", size: "—", mod: "1d", count: 38 },
  { type: "folder", name: "SQL Dumps", size: "—", mod: "3d", count: 56 },
  { type: "folder", name: "Brand Assets", size: "—", mod: "1w", count: 212 },
  { type: "zip", name: "safaritours-2026-04-18.zip", size: "428 MB", mod: "2h" },
  { type: "sql", name: "kenyatech_backup_v18.sql", size: "1.2 GB", mod: "6h" },
  { type: "apk", name: "abancool-portal-v2.1.4.apk", size: "84 MB", mod: "1d" },
  { type: "pdf", name: "Q1-Financial-Report.pdf", size: "3.4 MB", mod: "2d" },
  { type: "img", name: "command-center-mockup.png", size: "12.8 MB", mod: "3d" },
  { type: "code", name: "deploy.sh", size: "4 KB", mod: "5d" },
];

const iconFor = (t: string) =>
  t === "folder" ? Folder
  : t === "zip" ? FileArchive
  : t === "sql" ? Database
  : t === "img" ? ImageIcon
  : t === "code" ? FileCode2
  : FileText;

function FilesPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  return (
    <div className="space-y-6">
      <PageHeader
        badge="cloud://abancool"
        title="File Manager"
        description="Premium cloud storage · drag, drop, preview, share"
        actions={
          <>
            <div className="flex items-center rounded-md border border-border bg-secondary/60 p-0.5">
              <button onClick={() => setView("grid")} className={`size-8 grid place-items-center rounded ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                <Grid3x3 className="size-3.5" />
              </button>
              <button onClick={() => setView("list")} className={`size-8 grid place-items-center rounded ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                <List className="size-3.5" />
              </button>
            </div>
            <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
              <Upload className="size-3.5" /> Upload
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total Storage" value="2.4 TB" delta="of 5 TB" icon={FolderArchive} />
        <StatTile label="Files" value="14,238" delta="+128 today" icon={FileText} />
        <StatTile label="Shared" value="312" delta="48 expiring" icon={Download} />
        <StatTile label="Bandwidth (24h)" value="84 GB" delta="+12%" icon={Upload} tone="success" />
      </div>

      {/* Dropzone */}
      <motion.div
        whileHover={{ borderColor: "oklch(0.72 0.18 235 / 0.6)" }}
        className="rounded-2xl border-2 border-dashed border-border p-8 text-center bg-secondary/20 hover:bg-secondary/30 transition"
      >
        <div className="size-12 rounded-full bg-primary/10 grid place-items-center text-primary mx-auto mb-3 glow-blue">
          <Upload className="size-5" />
        </div>
        <div className="font-semibold">Drop files to upload</div>
        <div className="text-xs text-muted-foreground mt-1">APKs, ZIPs, SQL backups, images, source code · up to 5 GB</div>
      </motion.div>

      <Panel title="My Files" subtitle="Root / Cloud Storage">
        {view === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {items.map((f, i) => {
              const Icon = iconFor(f.type);
              return (
                <motion.div
                  key={f.name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ y: -3 }}
                  className="rounded-xl border border-border bg-secondary/40 p-3 cursor-pointer hover:border-primary/40 hover:shadow-[0_0_24px_-8px_oklch(0.72_0.18_235/0.5)] transition"
                >
                  <div className="size-12 rounded-lg bg-primary/10 grid place-items-center text-primary mb-2">
                    <Icon className="size-5" />
                  </div>
                  <div className="text-xs font-medium truncate">{f.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex justify-between">
                    <span>{f.size}</span>
                    <span>{f.mod}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-2 py-3 font-medium">Name</th>
                <th className="px-2 py-3 font-medium">Size</th>
                <th className="px-2 py-3 font-medium">Modified</th>
                <th className="px-2 py-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((f, i) => {
                const Icon = iconFor(f.type);
                return (
                  <tr key={f.name} className="border-b border-border/60 hover:bg-secondary/40">
                    <td className="px-2 py-3 flex items-center gap-2 font-medium">
                      <Icon className="size-4 text-primary" /> {f.name}
                      {f.type === "folder" && <Badge>{f.count} items</Badge>}
                    </td>
                    <td className="px-2 py-3 text-muted-foreground font-mono text-xs">{f.size}</td>
                    <td className="px-2 py-3 text-muted-foreground text-xs">{f.mod} ago</td>
                    <td className="px-2 py-3"><MoreVertical className="size-4 text-muted-foreground" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
