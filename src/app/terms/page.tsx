import Link from "next/link";
import Image from "next/image";
import { FileText, AlertTriangle, Scale, Users, Ban, Mail } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans">
      {/* Navbar */}
      <nav className="flex justify-between items-center py-6 px-8 max-w-7xl mx-auto border-b border-slate-100">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.png" alt="Geolog Logo" width={40} height={40} className="h-10 w-auto" />
          <span className="text-2xl font-bold tracking-tight text-[var(--color-geolog-blue)]">
            Portal Geolog
          </span>
        </Link>

        <Link href="/login">
          <button className="flex items-center gap-2 bg-[var(--color-geolog-blue)] hover:bg-[var(--color-geolog-dark)] text-white px-6 py-2.5 rounded-full font-medium transition-all duration-300">
            <span>Área do Cliente</span>
          </button>
        </Link>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-8 py-16">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-[var(--color-geolog-blue)] text-sm font-bold tracking-wide uppercase mb-6">
            <FileText className="w-4 h-4" />
            Termos de Serviço
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-[var(--color-geolog-blue)] mb-4">
            Termos de Serviço
          </h1>

          <p className="text-lg text-slate-500">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-8">
          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4 flex items-center gap-3">
              <FileText className="w-6 h-6" />
              1. Aceitação dos Termos
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Ao acessar e usar o Portal Geolog, você concorda com estes Termos
              de Serviço e com nossa Política de Privacidade. Se você não
              concordar com qualquer parte destes termos, não deve usar nosso
              serviço.
            </p>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4 flex items-center gap-3">
              <Users className="w-6 h-6" />
              2. Descrição do Serviço
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              O Portal Geolog é uma plataforma de gestão logística on-demand que
              oferece:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-600 ml-4">
              <li>Gestão de ordens de serviço</li>
              <li>Controle de frotas e motoristas</li>
              <li>Gerenciamento de passageiros</li>
              <li>CRM e relacionamento com clientes</li>
              <li>Integração com sistemas de comunicação (WhatsApp)</li>
            </ul>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6" />
              3. Responsabilidades do Usuário
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Ao usar o Portal Geolog, você concorda em:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-600 ml-4">
              <li>Fornecer informações verdadeiras, precisas e completas</li>
              <li>Manter suas credenciais de acesso seguras e confidenciais</li>
              <li>
                Notificar imediatamente sobre qualquer uso não autorizado de sua
                conta
              </li>
              <li>Usar o serviço apenas para fins legais e autorizados</li>
              <li>
                Não tentar interferir ou interromper o funcionamento do serviço
              </li>
              <li>
                Respeitar os direitos de terceiros e a legislação aplicável
              </li>
            </ul>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4 flex items-center gap-3">
              <Ban className="w-6 h-6" />
              4. Uso Proibido
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              É estritamente proibido:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-600 ml-4">
              <li>Usar o serviço para atividades fraudulentas ou ilegais</li>
              <li>Upload ou compartilhamento de conteúdo malicioso</li>
              <li>Coleta de dados de outros usuários sem autorização</li>
              <li>
                Tentativas de hacking, engenharia social ou ataques à segurança
              </li>
              <li>
                Violação de direitos autorais, marcas ou propriedade intelectual
              </li>
              <li>
                Spam, envio de mensagens não solicitadas ou abuso do sistema
              </li>
            </ul>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4 flex items-center gap-3">
              <Scale className="w-6 h-6" />
              5. Limitação de Responsabilidade
            </h2>
            <p className="text-slate-600 leading-relaxed">
              O Portal Geolog é fornecido &quot;como está&quot; e &quot;conforme disponível&quot;.
              Não garantimos que o serviço será ininterrupto, seguro ou livre de
              erros. A Transportadora Geolog não será responsável por danos
              diretos, indiretos, incidentais ou consequentes decorrentes do uso
              ou incapacidade de usar o serviço.
            </p>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4">
              6. Propriedade Intelectual
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Todo o conteúdo, design, funcionalidades e código do Portal Geolog
              são propriedade exclusiva da Transportadora Geolog ou de seus
              licenciadores. Você não pode copiar, modificar, distribuir ou
              criar obras derivadas sem autorização expressa.
            </p>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4">
              7. Modificações do Serviço
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Reservamo-nos o direito de modificar, suspender ou descontinuar
              qualquer parte do serviço a qualquer momento, com ou sem aviso
              prévio. Não seremos responsáveis por qualquer modificação,
              suspensão ou descontinuação do serviço.
            </p>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4">
              8. Rescisão
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Podemos suspender ou encerrar seu acesso ao Portal Geolog a
              qualquer momento, com ou sem causa, com ou sem aviso prévio,
              especialmente se você violar estes Termos de Serviço.
            </p>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4">
              9. Lei Aplicável
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Estes Termos de Serviço são regidos pelas leis da República
              Federativa do Brasil. Quaisquer disputas serão resolvidas nos
              tribunais competentes do país.
            </p>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4 flex items-center gap-3">
              <Mail className="w-6 h-6" />
              10. Contato
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Para questões sobre estes Termos de Serviço, entre em contato
              conosco através do e-mail: contato@portalgeolog.com.br
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Transportadora Geolog. Todos os
            direitos reservados.
          </p>
          <div className="flex gap-6">
            <Link
              href="/policy"
              className="text-slate-500 hover:text-[var(--color-geolog-blue)] text-sm font-medium transition-colors"
            >
              Política de Privacidade
            </Link>
            <Link
              href="/terms"
              className="text-slate-500 hover:text-[var(--color-geolog-blue)] text-sm font-medium transition-colors"
            >
              Termos de Serviço
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
