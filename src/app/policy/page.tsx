import Link from "next/link";
import Image from "next/image";
import { Shield, FileText, Lock, Eye, Trash2, Globe } from "lucide-react";

export default function PrivacyPolicy() {
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
            <Shield className="w-4 h-4" />
            Política de Privacidade
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-[var(--color-geolog-blue)] mb-4">
            Política de Privacidade
          </h1>

          <p className="text-lg text-slate-500">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-8">
          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4 flex items-center gap-3">
              <FileText className="w-6 h-6" />
              1. Introdução
            </h2>
            <p className="text-slate-600 leading-relaxed">
              A Transportadora Geolog (&quot;nós&quot;, &quot;nosso&quot;) respeita sua privacidade
              e está comprometida em proteger seus dados pessoais. Esta política
              de privacidade descreve como coletamos, usamos e protegemos suas
              informações quando você utiliza o Portal Geolog.
            </p>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4 flex items-center gap-3">
              <Globe className="w-6 h-6" />
              2. Dados que Coletamos
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Coletamos os seguintes tipos de dados:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-600 ml-4">
              <li>
                <strong>Dados de Contato:</strong> Nome, e-mail, telefone,
                celular
              </li>
              <li>
                <strong>Dados de Identificação:</strong> CPF, CNPJ, RG, CNH
              </li>
              <li>
                <strong>Dados de Endereço:</strong> Logradouro, número,
                complemento, bairro, cidade, estado, CEP
              </li>
              <li>
                <strong>Dados de Veículo:</strong> Placa, RENAVAM, modelo,
                marca, ano, cor
              </li>
              <li>
                <strong>Dados de Documentos:</strong> Fotos de documentos,
                comprovantes
              </li>
              <li>
                <strong>Dados de Operação:</strong> Ordens de serviço,
                waypoints, histórico de viagens
              </li>
            </ul>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4 flex items-center gap-3">
              <Eye className="w-6 h-6" />
              3. Como Usamos seus Dados
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Utilizamos seus dados para:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-600 ml-4">
              <li>Gerenciar ordens de serviço e operações logísticas</li>
              <li>Comunicar atualizações sobre suas solicitações</li>
              <li>
                Verificar identidade e documentos de motoristas e veículos
              </li>
              <li>Garantir a segurança e conformidade legal</li>
              <li>Melhorar nossos serviços e experiência do usuário</li>
              <li>Cumprir obrigações legais e regulatórias</li>
            </ul>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4 flex items-center gap-3">
              <Lock className="w-6 h-6" />
              4. Compartilhamento de Dados
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Não vendemos seus dados pessoais. Podemos compartilhar informações
              apenas quando necessário para:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-600 ml-4 mt-4">
              <li>Executar ordens de serviço com parceiros e fornecedores</li>
              <li>Cumprir requisitos legais ou ordens judiciais</li>
              <li>Proteger nossos direitos, propriedade ou segurança</li>
              <li>
                Com provedores de serviços que operam em nosso nome (ex:
                Supabase, Cloudflare)
              </li>
            </ul>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4 flex items-center gap-3">
              <Trash2 className="w-6 h-6" />
              5. Retenção e Exclusão
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Mantemos seus dados pelo tempo necessário para cumprir os fins
              para os quais foram coletados, exceto quando exigido por lei. Você
              pode solicitar a exclusão de seus dados entrando em contato
              conosco.
            </p>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4 flex items-center gap-3">
              <Shield className="w-6 h-6" />
              6. Segurança dos Dados
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Implementamos medidas de segurança técnicas e organizacionais para
              proteger seus dados contra acesso não autorizado, alteração,
              destruição ou perda. Isso inclui criptografia SSL, autenticação
              segura e controles de acesso baseados em funções.
            </p>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4">
              7. Seus Direitos
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Você tem o direito de:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-600 ml-4">
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos ou incorretos</li>
              <li>Solicitar a exclusão de seus dados</li>
              <li>Opor-se ao processamento de seus dados</li>
              <li>Solicitar a portabilidade de seus dados</li>
            </ul>
          </section>

          <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-[var(--color-geolog-blue)] mb-4">
              8. Contato
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Para questões sobre esta política de privacidade ou seus dados
              pessoais, entre em contato conosco através do e-mail:
              contato@portalgeolog.com.br
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
