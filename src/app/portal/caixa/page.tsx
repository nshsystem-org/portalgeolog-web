"use client";

import type { ReactElement } from "react";
import { RotateCcw } from "lucide-react";
import { CaixaAccessDenied } from "./_components/CaixaAccessDenied";
import { CaixaContasModal } from "./_components/CaixaContasModal";
import { CaixaFilters } from "./_components/CaixaFilters";
import { CaixaLancamentoModal } from "./_components/CaixaLancamentoModal";
import { CaixaStats } from "./_components/CaixaStats";
import { CaixaTable } from "./_components/CaixaTable";
import { CaixaToolbar } from "./_components/CaixaToolbar";
import { useCaixaPage } from "./_hooks/useCaixaPage";

export default function CaixaPage(): ReactElement {
  const page = useCaixaPage();

  if (!page.hasCaixaAccess) {
    return <CaixaAccessDenied />;
  }

  return (
    <div className="space-y-6 pb-10">
      <CaixaToolbar
        dataInicio={page.dataInicio}
        dataFim={page.dataFim}
        showFilters={page.showFilters}
        activeQuickRange={page.activeQuickRange}
        onToggleFilters={() => page.setShowFilters((current) => !current)}
        onSetQuickRange={page.setQuickRange}
        onOpenNovoLancamento={page.handleOpenNovoLancamento}
        onOpenContasModal={page.handleOpenContasModal}
        onDataInicioChange={(value) => {
          page.setDataInicio(value);
          page.setActiveQuickRange("custom");
        }}
        onDataFimChange={(value) => {
          page.setDataFim(value);
          page.setActiveQuickRange("custom");
        }}
      />

      <CaixaStats stats={page.stats} />

      <CaixaFilters
        isVisible={page.showFilters}
        contaId={page.contaId}
        tipo={page.tipo}
        categoria={page.categoria}
        formaPagamento={page.formaPagamento}
        clienteId={page.clienteId}
        parceiroId={page.parceiroId}
        driverId={page.driverId}
        origem={page.origem}
        contas={page.contas}
        clientes={page.clientes}
        parceiros={page.parceiros}
        drivers={page.drivers}
        onContaChange={page.setContaId}
        onTipoChange={page.setTipo}
        onCategoriaChange={page.setCategoria}
        onFormaPagamentoChange={page.setFormaPagamento}
        onClienteChange={page.setClienteId}
        onParceiroChange={page.setParceiroId}
        onDriverChange={page.setDriverId}
        onOrigemChange={page.setOrigem}
        onReset={page.resetFilters}
      />

      <CaixaTable
        items={page.lancamentosTable.items}
        loading={page.lancamentosTable.loading}
        searchTerm={page.lancamentosTable.searchTerm}
        onSearchChange={page.lancamentosTable.setSearchTerm}
        pagination={{
          page: page.lancamentosTable.page,
          pageSize: page.lancamentosTable.pageSize,
          totalItems: page.lancamentosTable.totalCount,
          onPageChange: page.lancamentosTable.setPage,
        }}
        contaMap={page.contaMap}
        customerMap={page.customerMap}
        driverMap={page.driverMap}
        partnerMap={page.partnerMap}
        openActionMenuId={page.openActionMenuId}
        actionMenuRefs={page.actionMenuRefs}
        onToggleActionMenu={(id) => {
          page.setOpenActionMenuId((current) => (current === id ? null : id));
        }}
        onEditar={page.handleEditarLancamento}
        onExcluir={page.handleExcluirLancamento}
        onOpenComprovante={page.handleOpenComprovante}
        isLancamentoEditavel={page.isLancamentoEditavel}
      />

      <CaixaLancamentoModal
        isOpen={page.showLancamentoModal}
        lancamentoEmEdicao={page.lancamentoEmEdicao}
        contas={page.contas}
        clientes={page.clientes}
        parceiros={page.parceiros}
        drivers={page.drivers}
        fornecedores={page.fornecedores}
        saving={page.savingLancamento}
        onClose={page.closeLancamentoModal}
        onSalvar={page.handleSalvarLancamento}
      />

      <CaixaContasModal
        isOpen={page.showContasModal}
        contas={page.contas}
        saving={page.savingConta}
        onClose={page.closeContasModal}
        onSalvar={page.handleSalvarConta}
        onToggleAtiva={page.handleToggleContaAtiva}
        onSetDefault={page.handleSetContaDefault}
      />

      {page.overviewLoading || page.contasLoading ? (
        <div className="fixed right-8 bottom-8 z-50 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-6 py-4 font-black text-slate-800 shadow-2xl backdrop-blur-md">
          <RotateCcw size={20} className="animate-spin text-blue-600" />
          Atualizando Caixa...
        </div>
      ) : null}
    </div>
  );
}
