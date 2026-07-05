"use client";

import React, { ReactNode } from "react";
import { Search, Loader2 } from "lucide-react";

type ColumnRender<T> = {
  bivarianceHack: (value: unknown, item: T, index: number) => ReactNode;
}["bivarianceHack"];

export interface Column<T> {
  key: keyof T | string;
  title: string;
  render?: ColumnRender<T>;
  width?: string;
  align?: "left" | "center" | "right";
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  disableClientSearch?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  className?: string;
  showHeader?: boolean;
  hover?: boolean;
  striped?: boolean;
  compact?: boolean;
  actionButton?: ReactNode;
  headerContent?: ReactNode;
  maxHeight?: string;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<T extends { id?: string | number }>({
  data,
  columns,
  loading = false,
  searchTerm = "",
  onSearchChange,
  disableClientSearch = false,
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum registro encontrado.",
  emptyIcon,
  className = "",
  showHeader = true,
  hover = true,
  striped = true,
  compact = false,
  actionButton,
  headerContent,
  maxHeight,
  pagination,
}: DataTableProps<T>) {
  const filteredData =
    disableClientSearch || !searchTerm
      ? data
      : data.filter((item) =>
          Object.values(item).some((value) =>
            String(value).toLowerCase().includes(searchTerm.toLowerCase()),
          ),
        );

  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.totalItems / pagination.pageSize))
    : 1;
  const currentPage = pagination
    ? Math.min(Math.max(1, pagination.page), totalPages)
    : 1;
  const safePageSize = pagination?.pageSize ?? 10;
  const totalItems = pagination?.totalItems ?? filteredData.length;

  const buildPageItems = () => {
    if (!pagination || totalPages <= 1) return [] as Array<number | "ellipsis">;

    const pages: Array<number | "ellipsis"> = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
      return pages;
    }

    pages.push(1);

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) pages.push("ellipsis");

    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }

    if (end < totalPages - 1) pages.push("ellipsis");

    pages.push(totalPages);
    return pages;
  };

  const getAlignmentClass = (align?: "left" | "center" | "right") => {
    switch (align) {
      case "center":
        return "text-center";
      case "right":
        return "text-right";
      default:
        return "text-left";
    }
  };

  const getPaddingClass = () => {
    if (compact) return "px-4 py-2";
    return "px-6 py-4";
  };

  const rootClassName = maxHeight
    ? `flex h-full min-h-0 flex-col gap-4 ${className}`
    : `space-y-4 ${className}`;
  const containerClassName = maxHeight
    ? "bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col min-h-0"
    : "bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden";
  const scrollClassName = maxHeight
    ? "overflow-y-auto flex-1 min-h-0 custom-scrollbar"
    : "";

  return (
    <div className={rootClassName}>
      {(onSearchChange || actionButton) && (
        <div className="flex gap-3 items-center">
          {onSearchChange && (
            <div className="relative group flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                size={18}
              />
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="w-full pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 font-bold text-sm transition-all"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          )}
          {actionButton && actionButton}
        </div>
      )}

      {headerContent && headerContent}

      <div
        className={containerClassName}
        style={maxHeight ? { maxHeight, minHeight: 0 } : undefined}
      >
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              Carregando...
            </p>
          </div>
        ) : (
          <div className={scrollClassName}>
            <table className="w-full text-left">
              {showHeader && (
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    {columns.map((column) => (
                      <th
                        key={String(column.key)}
                        className={`${getPaddingClass()} text-[12px] font-black uppercase tracking-widest text-slate-600 ${getAlignmentClass(column.align)} ${column.className}`}
                        style={{ width: column.width }}
                      >
                        {column.title}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody className={striped ? "divide-y divide-slate-100" : ""}>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-20">
                      <div className="flex flex-col items-center justify-center gap-4 text-slate-400">
                        {emptyIcon}
                        <p className="font-bold italic">{emptyMessage}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, index) => (
                    <tr
                      key={item.id || index}
                      className={`${hover ? "hover:bg-slate-50/50 transition-colors" : ""} ${striped && index % 2 === 0 ? "bg-white" : ""}`}
                    >
                      {columns.map((column) => (
                        <td
                          key={String(column.key)}
                          className={`${getPaddingClass()} ${getAlignmentClass(column.align)} ${column.className}`}
                          style={{ width: column.width }}
                        >
                          {column.render
                            ? column.render(
                                item[column.key as keyof T],
                                item,
                                index,
                              )
                            : String(item[column.key as keyof T] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination && totalItems > 0 && totalPages > 1 && (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-1">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">
            Mostrando{" "}
            {Math.min((currentPage - 1) * safePageSize + 1, totalItems)}-
            {Math.min(currentPage * safePageSize, totalItems)} de {totalItems}
          </p>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              type="button"
              onClick={() => pagination.onPageChange(1)}
              disabled={currentPage === 1 || loading}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
            >
              &laquo;
            </button>
            <button
              type="button"
              onClick={() => pagination.onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Anterior
            </button>

            <div className="flex items-center gap-2">
              {buildPageItems().map((item, index) =>
                item === "ellipsis" ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-2 text-slate-400 font-black"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => pagination.onPageChange(item)}
                    disabled={loading}
                    className={`min-w-10 px-4 py-2 rounded-xl border font-black text-sm transition-all cursor-pointer ${
                      item === currentPage
                        ? "bg-[var(--color-geolog-blue)] border-[var(--color-geolog-blue)] text-white shadow-lg shadow-blue-900/10"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>

            <button
              type="button"
              onClick={() => pagination.onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Próxima
            </button>
            <button
              type="button"
              onClick={() => pagination.onPageChange(totalPages)}
              disabled={currentPage === totalPages || loading}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
            >
              &raquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
