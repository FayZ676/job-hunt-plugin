"use client";

import { createColumnHelper, filterFn_equalsString, filterFn_includesString } from "@tanstack/react-table";
import { Copy, Trash2 } from "lucide-react";
import { Command, copyKey, useDiscard } from "@/components/act";
import { useDeck } from "@/components/Deck";
import DataTable, { features, type Look } from "@/components/DataTable";
import { payAmount, places, shortDate, shortPay } from "@/components/format";
import { ORDER, label, rankOf, reading } from "@/components/status";
import { offered } from "@/core/actions";
import Glyph from "@/components/Glyph";
import type { Option } from "@/components/Options";
import { Badge, Out, Score, Stamp } from "@/components/ui";
import type { Job } from "@/lib/web/queries";

const helper = createColumnHelper<typeof features, Job>();
const dash = <span className="text-soft">—</span>;
const look = (meta: Look) => meta;

const columns = helper.columns([
  helper.accessor("company", {
    header: "Company",
    meta: look({ width: "15%", search: true }),
    filterFn: filterFn_includesString,
    cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
  }),
  helper.accessor("title", {
    header: "Title",
    meta: look({ width: "32%", search: true }),
    filterFn: filterFn_includesString,
    cell: ({ getValue }) => (
      <span title={getValue()} className="line-clamp-2">
        {getValue()}
      </span>
    ),
  }),
  helper.accessor("score", {
    header: "Score",
    meta: look({ width: "4%", numeric: true }),
    enableColumnFilter: false,
    cell: ({ row, getValue }) => <Score value={getValue()} why={row.original.reason} />,
  }),
  helper.accessor("status", {
    header: "Status",
    meta: look({
      width: "11%",
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
  helper.accessor((job) => places(job.location).full || (job.remote ? "Remote" : ""), {
    id: "location",
    header: "Location",
    meta: look({ width: "18%", keep: "roomy", search: true }),
    filterFn: filterFn_includesString,
    cell: ({ row, getValue }) => {
      const full = getValue();
      if (!full) return dash;
      const { lead, more } = places(row.original.location);
      if (more < 1) return <span className="line-clamp-2">{full}</span>;
      return (
        <span title={full} className="whitespace-nowrap">
          {lead} <span className="text-soft">+{more}</span>
        </span>
      );
    },
  }),
  helper.accessor((job) => payAmount(job.compensation), {
    id: "pay",
    header: "Pay",
    meta: look({ width: "8%", keep: "roomy", numeric: true }),
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
    meta: look({ width: "6%", keep: "wide", numeric: true }),
    enableColumnFilter: false,
    cell: ({ getValue }) => <Stamp>{shortDate(getValue())}</Stamp>,
  }),
  helper.accessor((job) => (job.resume ? "Résumé" : "None"), {
    id: "resume",
    header: "Resume",
    meta: look({
      width: "6%",
      keep: "wide",
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
      onPick: () => copyKey(job.key),
    },
    {
      key: "delete",
      label: "Delete job",
      tone: "grave" as const,
      icon: <Glyph icon={Trash2} size={13} />,
      onPick: () => drop(job.key),
    },
  ];

  return (
    <DataTable
      data={rows}
      columns={columns}
      empty="No openings yet."
      href={(job) => `/jobs/${encodeURIComponent(job.key)}`}
      menu={menu}
    />
  );
}
