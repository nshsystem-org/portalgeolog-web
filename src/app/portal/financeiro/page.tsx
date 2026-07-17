"use client";

import type { ReactElement } from "react";
import { RotateCcw } from "lucide-react";
import RelatorioModal from "@/components/financeiro/RelatorioModal";
import { FaturamentoLoteModal } from "./_components/FaturamentoLoteModal";
import { FinanceiroAccessDenied } from "./_components/FinanceiroAccessDenied";
import { FinanceiroFilters } from "./_components/FinanceiroFilters";
import { FinanceiroModals } from "./_components/FinanceiroModals";
import { FinanceiroStats } from "./_components/FinanceiroStats";
import { FinanceiroTable } from "./_components/FinanceiroTable";
import { FinanceiroToolbar } from "./_components/FinanceiroToolbar";
import { useFinanceiroPage } from "./_hooks/useFinanceiroPage";

export default function MedicaoFinanceiraPage(): ReactElement {
  const page = useFinanceiroPage();

  if (!page.hasFinanceiroAccess) {
    return <FinanceiroAccessDenied />;
  }

  return (
    <div className="space-y-6 pb-10">
      <FinanceiroToolbar
        dataInicio={page.dataInicio}
        dataFim={page.dataFim}
        showFilters={page.showFilters}
        activeQuickRange={page.activeQuickRange}
        reportLoading={page.reportLoading}
        faturamentoLoteLoading={page.faturamentoLoteLoading}
        onToggleFilters={() => page.setShowFilters((current) => !current)}
        onSetQuickRange={page.setQuickRange}
        onOpenReportModal={page.handleOpenReportModal}
        onOpenFaturamentoLote={page.handleOpenFaturamentoLote}
        onDataInicioChange={(value) => {
          page.setDataInicio(value);
          page.setActiveQuickRange("custom");
        }}
        onDataFimChange={(value) => {
          page.setDataFim(value);
          page.setActiveQuickRange("custom");
        }}
      />

      <FinanceiroStats stats={page.stats} driverId={page.driverId} />

      <FinanceiroFilters
        isVisible={page.showFilters}
        clienteId={page.clienteId}
        centroCustoId={page.centroCustoId}
        parceiroId={page.parceiroId}
        driverId={page.driverId}
        statusOperacional={page.statusOperacional}
        statusFinanceiro={page.statusFinanceiro}
        noShowFilter={page.noShowFilter}
        horaExtraFilter={page.horaExtraFilter}
        clientes={page.clientes}
        parceiros={page.parceiros}
        drivers={page.drivers}
        onClienteChange={(value) => {
          page.setClienteId(value);
          page.setCentroCustoId("");
        }}
        onCentroCustoChange={page.setCentroCustoId}
        onParceiroChange={page.setParceiroId}
        onDriverChange={page.setDriverId}
        onStatusOperacionalChange={page.setStatusOperacional}
        onStatusFinanceiroChange={page.setStatusFinanceiro}
        onNoShowFilterChange={page.setNoShowFilter}
        onHoraExtraFilterChange={page.setHoraExtraFilter}
        onReset={page.resetFilters}
      />

      <FinanceiroTable
        items={page.financeTable.items}
        loading={page.financeTable.loading}
        searchTerm={page.financeTable.searchTerm}
        onSearchChange={page.financeTable.setSearchTerm}
        pagination={{
          page: page.financeTable.page,
          pageSize: page.financeTable.pageSize,
          totalItems: page.financeTable.totalCount,
          onPageChange: page.financeTable.setPage,
        }}
        drivers={page.drivers}
        driverId={page.driverId}
        onDriverChange={page.setDriverId}
        driverTipoFilter={page.driverTipoFilter}
        onDriverTipoChange={page.setDriverTipoFilter}
        pendingRepasseValue={
          (page.stats.totalCustoAutonomos - page.stats.totalPagoAutonomos) +
          (page.stats.totalCustoParceiros - page.stats.totalPagoParceiros)
        }
        repassePeriodStart={page.dataInicio}
        repassePeriodEnd={page.dataFim}
        statsLoading={page.overviewLoading}
        onOpenRepasseLote={page.handleOpenRepasseLote}
        customerMap={page.customerMap}
        centerMap={page.centerMap}
        driverMap={page.driverMap}
        partnerMap={page.partnerMap}
        driverPartnerMap={page.driverPartnerMap}
        driverVinculoMap={page.driverVinculoMap}
        actionMenuRefs={page.actionMenuRefs}
        openActionMenuId={page.openActionMenuId}
        onToggleActionMenu={(id) => {
          page.setOpenActionMenuId((current) => (current === id ? null : id));
        }}
        onViewOS={page.handleViewOS}
        onOpenAttachment={page.handleOpenAttachment}
        onOpenFaturar={page.handleOpenFaturar}
        onOpenRecebimento={page.handleOpenRecebimento}
        onOpenRepasse={page.handleOpenRepasse}
      />

      <FinanceiroModals
        viewingOS={page.viewingOS}
        viewingOSLoading={page.viewingOSLoading}
        actionTarget={page.actionTarget}
        repasseTarget={page.repasseTarget}
        repasseLoading={page.repasseLoading}
        repasseLoteTarget={page.repasseLoteTarget}
        repasseLoteLoading={page.repasseLoteLoading}
        uploading={page.uploading}
        faturarFile={page.faturarFile}
        faturarTipoDocumento={page.faturarTipoDocumento}
        faturarObservacao={page.faturarObservacao}
        recebimentoObservacao={page.recebimentoObservacao}
        fileInputRef={page.fileInputRef}
        customerMap={page.customerMap}
        centerMap={page.centerMap}
        driverMap={page.driverMap}
        partnerMap={page.partnerMap}
        driverPartnerMap={page.driverPartnerMap}
        onCloseViewingOS={page.closeViewingOS}
        onCloseActionModal={page.closeActionModal}
        onCloseRepasse={page.closeRepasseModal}
        onCloseRepasseLote={page.closeRepasseLoteModal}
        onFaturarTipoDocumentoChange={page.setFaturarTipoDocumento}
        onFaturarFileChange={page.setFaturarFile}
        onFaturarObservacaoChange={page.setFaturarObservacao}
        onRecebimentoObservacaoChange={page.setRecebimentoObservacao}
        onUploadFaturamento={page.uploadFaturamento}
        onConfirmRecebimento={page.confirmRecebimento}
        onConfirmRepasse={page.confirmRepasse}
        onConfirmRepasseLote={page.confirmRepasseLote}
      />

      {page.overviewLoading || page.dataLoading ? (
        <div className="fixed right-8 bottom-8 z-50 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-6 py-4 font-black text-slate-800 shadow-2xl backdrop-blur-md">
          <RotateCcw size={20} className="animate-spin text-blue-600" />
          Atualizando Dashboard...
        </div>
      ) : null}

      {page.showFaturamentoLoteModal ? (
        <FaturamentoLoteModal
          isOpen
          defaultDataInicio={page.dataInicio}
          defaultDataFim={page.dataFim}
          clientes={page.clientes}
          preview={page.faturamentoLotePreview}
          loading={page.faturamentoLoteLoading}
          onClose={page.closeFaturamentoLote}
          onBack={page.clearFaturamentoLotePreview}
          onPreview={page.handlePreviewFaturamentoLote}
          onConfirm={page.confirmFaturamentoLote}
        />
      ) : null}

      <RelatorioModal
        isOpen={page.showReportModal}
        onClose={() => page.setShowReportModal(false)}
        onGenerate={page.handleGenerateReport}
        defaultDataInicio={page.dataInicio}
        defaultDataFim={page.dataFim}
        loading={page.reportLoading}
        clientes={page.clientes}
        parceiros={page.parceiros}
        drivers={page.drivers}
        driverPartnerMap={page.driverPartnerMap}
      />
    </div>
  );
}
