"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { DemoTag, PayLabel, WorkBadge } from "@/components/app/ui";
import { ActionGlyph } from "@/components/dashboard/glyphs";
import type { Row } from "@/components/dashboard/data";
import { fday, fmt, PAY, WORK } from "@/lib/view";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  backgroundColor: "var(--surface)",
  foregroundColor: "var(--text)",
  headerBackgroundColor: "var(--chip)",
  headerTextColor: "var(--muted-foreground)",
  borderColor: "var(--line)",
  rowHoverColor: "var(--chip)",
  accentColor: "var(--blue)",
  fontFamily: "inherit",
  fontSize: 14,
  headerFontSize: 12,
  headerFontWeight: 500,
  rowHeight: 60,
  headerHeight: 40,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  columnBorder: false,
  cellHorizontalPadding: 10,
});

function ActionCell({ data }: ICellRendererParams<Row>) {
  const router = useRouter();
  if (!data) return null;
  const a = data.action;
  return (
    <span className="flex h-full items-center justify-end">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          router.push(data.href);
        }}
        className={
          a
            ? "flex h-[34px] items-center gap-1.5 rounded-[7px] bg-em px-2.5 text-[12.5px] font-semibold whitespace-nowrap text-on-em"
            : "flex h-[34px] items-center gap-1.5 rounded-[7px] border border-line2 px-2.5 text-[12.5px] font-semibold whitespace-nowrap text-muted-foreground"
        }
      >
        <ActionGlyph name={a?.icon ?? "view"} />
        {a?.label ?? "View"}
      </button>
    </span>
  );
}

/** Desktop milestone table (AG Grid). Sorting is built in; filtering happens upstream. */
export function MilestoneGrid({ rows, quickFilter, isClient }: { rows: Row[]; quickFilter: string; isClient: boolean }) {
  const router = useRouter();
  const cols = useMemo<ColDef<Row>[]>(
    () => [
      {
        field: "project",
        headerName: "Project",
        flex: 1.4,
        minWidth: 150,
        cellRenderer: ({ data }: ICellRendererParams<Row>) =>
          data ? (
            <span className="flex h-full items-center gap-2 font-medium">
              <span className="truncate">{data.project}</span>
              {data.isDemo && <DemoTag />}
            </span>
          ) : null,
      },
      { field: "party", headerName: isClient ? "Freelancer" : "Client", flex: 1, minWidth: 110, cellClass: "text-muted-foreground" },
      { field: "milestone", headerName: "Milestone", flex: 1.3, minWidth: 140 },
      { field: "amount", headerName: "Amount", flex: 0.75, minWidth: 90, valueFormatter: (p) => fmt(p.value), cellClass: "font-mono text-[13px]" },
      {
        field: "work",
        headerName: "Work status",
        flex: 0.95,
        minWidth: 120,
        comparator: (a, b) => WORK[a as Row["work"]].label.localeCompare(WORK[b as Row["work"]].label),
        cellRenderer: ({ data }: ICellRendererParams<Row>) => (data ? <span className="flex h-full items-center"><WorkBadge status={data.work} /></span> : null),
      },
      {
        field: "pay",
        headerName: "Payment status",
        flex: 1.15,
        minWidth: 140,
        comparator: (a, b) => PAY[a as Row["pay"]].label.localeCompare(PAY[b as Row["pay"]].label),
        cellRenderer: ({ data }: ICellRendererParams<Row>) =>
          data ? (
            <span className="flex h-full items-center">
              <PayLabel status={data.pay} note={data.pay === "partial" ? `${fmt(data.captured)} of ${fmt(data.amount)}` : undefined} />
            </span>
          ) : null,
      },
      { field: "updated", headerName: "Updated", flex: 0.6, minWidth: 80, sort: "desc", valueFormatter: (p) => fday(p.value), cellClass: "text-muted-foreground text-[13px]" },
      { headerName: "Actions", width: 104, sortable: false, cellRenderer: ActionCell, headerClass: "ag-right-aligned-header" },
    ],
    [isClient],
  );
  // Quick search also matches the other party and the client name.
  const getQuickFilterText = (r: Row) => [r.project, r.client, r.freelancer, r.milestone].join(" ");

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        <AgGridReact<Row>
          theme={theme}
          rowData={rows}
          columnDefs={cols}
          defaultColDef={{ sortable: true, resizable: false, suppressMovable: true, getQuickFilterText: (p) => getQuickFilterText(p.data as Row) }}
          quickFilterText={quickFilter}
          domLayout="autoHeight"
          getRowId={(p) => p.data.id}
          onRowClicked={(e) => e.data && router.push(e.data.href)}
          rowClass="cursor-pointer"
          suppressCellFocus
          animateRows
        />
      </div>
    </div>
  );
}
