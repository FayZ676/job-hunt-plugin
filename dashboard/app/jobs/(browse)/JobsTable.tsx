"use client";

import { createColumnHelper, filterFn_equalsString, filterFn_includesString } from "@tanstack/react-table";
import { Copy, Trash2 } from "lucide-react";
import { Command, useDiscard } from "@/components/act";
import { useDeck } from "@/components/Deck";
import DataTable, { features, type Look } from "@/components/DataTable";
import { payAmount, shortDate, shortPay, shortPlace } from "@/components/format";
import { ORDER, label, rankOf, reading } from "@/components/status";
import { offered } from "@/core/actions";
import Glyph from "@/components/Glyph";
import type { Option } from "@/components/Options";
import { say } from "@/components/Toaster";
import { Badge, Out, Score, Stamp } from "@/components/ui";
import type { Job } from "@/lib/web/queries";

const helper = createColumnHelper<typeof features, Job>();
const dash = <span className="text-soft">—</span>;
const look = (meta: Look) => meta;

const columns = helper.columns([
  helper.accessor("company", {
    header: "Company",
    meta: look({ width: "16%", search: true }),
    filterFn: filterFn_includesString,
    cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
  }),
  helper.accessor("title", {
    header: "Title",
    meta: look({ width: "26%", search: true }),
    filterFn: filterFn_includesString,
  }),
  helper.accessor("score", {
    header: "Score",
    meta: look({ width: "6%", numeric: true }),
    enableColumnFilter: false,
    cell: ({ row, getValue }) => <Score value={getValue()} why={row.original.reason} />,
  }),
  helper.accessor("status", {
    header: "Status",
    meta: look({
      width: "12%",
      facet: {
        legend: "Filter openings by status",
        order: ORDER,
        read: (key) => ({
          label: label(key),
          quiet: reading(key).stage === "closed",
          icon: <Glyph icon={reading(key).icon} />,
        }),
      },
    }),
    filterFn: filterFn_equalsString,
    sortFn: (left, right) => rankOf(left.original.status) - rankOf(right.original.status),
    cell: ({ getValue }) => <Badge>{getValue()}</Badge>,
  }),
  helper.accessor((job) => shortPlace(job.location) || (job.remote ? "Remote" : null), {
    id: "location",
    header: "Location",
    meta: look({ width: "20%", hideNarrow: true, search: true }),
    filterFn: filterFn_includesString,
    cell: ({ getValue }) => getValue() ?? dash,
  }),
  helper.accessor((job) => payAmount(job.compensation), {
    id: "pay",
    header: "Pay",
    meta: look({ width: "8%", hideNarrow: true, numeric: true }),
    enableColumnFilter: false,
    cell: ({ row }) =>
      shortPay(row.original.compensation) ? (
        <span className="whitespace-nowrap">{shortPay(row.original.compensation)}</span>
      ) : (
        dash
      ),
  }),
  helper.accessor("first_seen", {
    header: "Seen",
    meta: look({ width: "6%", hideNarrow: true, numeric: true }),
    enableColumnFilter: false,
    cell: ({ getValue }) => <Stamp>{shortDate(getValue())}</Stamp>,
  }),
  helper.accessor((job) => (job.resume ? "Résumé" : "None"), {
    id: "resume",
    header: "Resume",
    meta: look({
      width: "6%",
      hideNarrow: true,
      facet: { legend: "Filter openings by résumé", read: (key) => ({ label: key, quiet: key === "None" }) },
    }),
    filterFn: filterFn_equalsString,
    enableSorting: false,
    cell: ({ row }) =>
      row.original.resume ? <Out href={`/asset/resume/${encodeURIComponent(row.original.key)}`}>Résumé</Out> : dash,
  }),
]);

export default function JobsTable({ rows }: { rows: Job[] }) {
  const { draft } = useDeck();
  const drop = useDiscard();

  const menu = (job: Job): Option[] => [
    ...offered(job.status).map(({ id }) => ({
      key: id,
      label: <Command id={id} />,
      onPick: () => draft(id, job.key),
    })),
    {
      key: "copy",
      label: "Copy job ID",
      icon: <Glyph icon={Copy} size={13} />,
      onPick: () => {
        navigator.clipboard.writeText(job.key).then(
          () => say("Job ID copied"),
          () => say("Could not copy the job ID", true),
        );
      },
    },
    {
      key: "delete",
      label: "Delete opening",
      tone: "grave" as const,
      icon: <Glyph icon={Trash2} size={13} />,
      onPick: () => drop(job.key, `${job.company} — ${job.title}`),
    },
  ];

  return (
    <DataTable
      data={rows}
      columns={columns}
      empty="Nothing scanned yet."
      href={(job) => `/jobs/${encodeURIComponent(job.key)}`}
      mark={(job) => reading(job.status).stage === "waiting"}
      menu={menu}
    />
  );
}
