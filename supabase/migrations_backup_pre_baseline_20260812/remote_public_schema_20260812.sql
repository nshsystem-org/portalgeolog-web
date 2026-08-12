-- BASELINE public schema

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- SEQUENCES
CREATE SEQUENCE IF NOT EXISTS public.protocolo_seq START WITH 1 INCREMENT BY 1;

-- TABLES
CREATE TABLE IF NOT EXISTS public.announcement_dismissals (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, announcement_id uuid NOT NULL, dismissed_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.app_notification_reads (notification_id uuid NOT NULL, user_id uuid NOT NULL, read_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.app_notifications (id uuid NOT NULL DEFAULT gen_random_uuid(), created_at timestamp with time zone DEFAULT now(), type text NOT NULL, title text NOT NULL, message text NOT NULL, target_audience text NOT NULL, target_user_id uuid, empresa_id uuid, created_by uuid, created_by_name text, created_by_avatar_url text, metadata jsonb DEFAULT '{}'::jsonb, category text NOT NULL DEFAULT 'sistema'::text);
CREATE TABLE IF NOT EXISTS public.app_notifications_sistema_backup_20260614 (id uuid, created_at timestamp with time zone, type text, title text, message text, target_audience text, target_user_id uuid, empresa_id uuid, created_by uuid, created_by_name text, created_by_avatar_url text, metadata jsonb);
CREATE TABLE IF NOT EXISTS public.app_settings (key text NOT NULL, value text NOT NULL, updated_at timestamp with time zone DEFAULT now());
CREATE TABLE IF NOT EXISTS public.app_versions (id uuid NOT NULL DEFAULT gen_random_uuid(), version text NOT NULL, build_hash text NOT NULL, deployed_at timestamp with time zone NOT NULL DEFAULT now(), deployed_by text NOT NULL, notes text, created_at timestamp with time zone NOT NULL DEFAULT now(), display_version text NOT NULL);
CREATE TABLE IF NOT EXISTS public.bancos (id uuid NOT NULL DEFAULT gen_random_uuid(), nome text NOT NULL, sigla text NOT NULL, cor text NOT NULL DEFAULT '#64748b'::text, ativo boolean NOT NULL DEFAULT true, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());
CREATE TABLE IF NOT EXISTS public.caixa_contas (id uuid NOT NULL DEFAULT gen_random_uuid(), nome text NOT NULL, tipo text NOT NULL DEFAULT 'caixa'::text, saldo_inicial numeric(14,2) NOT NULL DEFAULT 0, ativa boolean NOT NULL DEFAULT true, is_default boolean NOT NULL DEFAULT false, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), saldo_atual numeric(14,2) NOT NULL DEFAULT 0, banco_id uuid);
CREATE TABLE IF NOT EXISTS public.caixa_lancamentos (id uuid NOT NULL DEFAULT gen_random_uuid(), conta_id uuid NOT NULL, tipo text NOT NULL, valor numeric(14,2) NOT NULL, data date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date, descricao text NOT NULL DEFAULT ''::text, categoria text NOT NULL DEFAULT 'outros'::text, forma_pagamento text NOT NULL DEFAULT 'outro'::text, cliente_id uuid, parceiro_id uuid, driver_id uuid, os_id uuid, origem text NOT NULL DEFAULT 'manual'::text, anexo_path text, created_by uuid, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());
CREATE TABLE IF NOT EXISTS public.centros_custo (id uuid NOT NULL DEFAULT gen_random_uuid(), nome text NOT NULL, cliente_id uuid NOT NULL, created_at timestamp with time zone DEFAULT now(), arquivado boolean DEFAULT false);
CREATE TABLE IF NOT EXISTS public.chat_conversations (id uuid NOT NULL DEFAULT gen_random_uuid(), type text NOT NULL DEFAULT 'direct'::text, title text, created_by uuid, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.chat_messages (id uuid NOT NULL DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL, sender_id uuid NOT NULL, content text NOT NULL, message_type text NOT NULL DEFAULT 'text'::text, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now(), is_edited boolean NOT NULL DEFAULT false, reply_to_id uuid);
CREATE TABLE IF NOT EXISTS public.chat_participants (id uuid NOT NULL DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL, user_id uuid NOT NULL, joined_at timestamp with time zone NOT NULL DEFAULT now(), last_read_at timestamp with time zone, is_admin boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS public.clientes (id uuid NOT NULL DEFAULT gen_random_uuid(), nome text NOT NULL, contato text, created_at timestamp with time zone DEFAULT now(), arquivado boolean DEFAULT false);
CREATE TABLE IF NOT EXISTS public.docagem_instancias (id uuid NOT NULL DEFAULT gen_random_uuid(), docagem_id uuid NOT NULL, data date NOT NULL, horario_inicio time without time zone NOT NULL, horario_fim time without time zone NOT NULL, endereco text NOT NULL, motorista_id uuid, veiculo_id uuid, valor numeric(12,2) NOT NULL, custo numeric(12,2), status text NOT NULL DEFAULT 'pendente'::text, finalizada_em timestamp with time zone, finalizada_por uuid, observacao_financeira text);
CREATE TABLE IF NOT EXISTS public.docagem_lancamentos (id uuid NOT NULL DEFAULT gen_random_uuid(), docagem_instancia_id uuid NOT NULL, data date NOT NULL, cliente_id uuid, centro_custo_id uuid, motorista_id uuid, valor numeric(12,2) NOT NULL, custo numeric(12,2), status text NOT NULL DEFAULT 'previsto'::text, created_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.docagens (id uuid NOT NULL DEFAULT gen_random_uuid(), cliente_id uuid NOT NULL, centro_custo_id uuid, solicitante_id uuid, motorista_id uuid, veiculo_id uuid, endereco text NOT NULL, data_inicio date NOT NULL, data_fim date NOT NULL, horario_inicio time without time zone NOT NULL, horario_fim time without time zone NOT NULL, dias_semana integer[] NOT NULL DEFAULT '{1,2,3,4,5}'::integer[], valor_diario numeric(12,2) NOT NULL, custo_diario numeric(12,2), observacao text, status text NOT NULL DEFAULT 'ativa'::text, created_at timestamp with time zone NOT NULL DEFAULT now(), created_by uuid, updated_at timestamp with time zone NOT NULL DEFAULT now(), protocolo text, observacao_financeira text);
CREATE TABLE IF NOT EXISTS public.driver_documents (id uuid NOT NULL DEFAULT gen_random_uuid(), driver_id uuid NOT NULL, name text NOT NULL, url text NOT NULL, type text NOT NULL, size integer NOT NULL DEFAULT 0, path text NOT NULL, created_at timestamp with time zone DEFAULT now());
CREATE TABLE IF NOT EXISTS public.driver_vehicles (id uuid NOT NULL DEFAULT gen_random_uuid(), driver_id uuid NOT NULL, vehicle_id uuid NOT NULL, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());
CREATE TABLE IF NOT EXISTS public.drivers (id uuid NOT NULL DEFAULT gen_random_uuid(), name text NOT NULL, cpf text NOT NULL, cnh text, phone text, status text DEFAULT 'active'::text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), vinculo_tipo character varying(10) DEFAULT 'interno'::character varying, parceiro_id uuid, vehicle_id uuid, email text, arquivado boolean DEFAULT false, avatar_url text);
CREATE TABLE IF NOT EXISTS public.financial_config_history (id uuid NOT NULL DEFAULT gen_random_uuid(), config_key text NOT NULL, value text NOT NULL, effective_from date NOT NULL, created_at timestamp with time zone DEFAULT now());
CREATE TABLE IF NOT EXISTS public.frontend_error_logs (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid, error_level text NOT NULL, component text, function_name text, error_message text, error_stack text, error_details jsonb, url text, user_agent text, created_at timestamp with time zone DEFAULT now());
CREATE TABLE IF NOT EXISTS public.notifications (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, title text NOT NULL, message text NOT NULL, type text NOT NULL, read boolean DEFAULT false, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());
CREATE TABLE IF NOT EXISTS public.ordens_servico (id uuid NOT NULL DEFAULT gen_random_uuid(), protocolo text NOT NULL, data date NOT NULL DEFAULT CURRENT_DATE, hora text DEFAULT ''::text, hora_extra text DEFAULT ''::text, os_number text DEFAULT ''::text, cliente_id uuid, solicitante text DEFAULT ''::text, centro_custo text DEFAULT ''::text, motorista text DEFAULT ''::text, valor_bruto numeric(12,2) DEFAULT 0, imposto numeric(12,2) DEFAULT 0, custo numeric(12,2) DEFAULT 0, lucro numeric(12,2) DEFAULT 0, status_operacional text NOT NULL DEFAULT 'Pendente'::text, status_financeiro text NOT NULL DEFAULT 'Pendente'::text, distancia text DEFAULT ''::text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), veiculo_id uuid, arquivado boolean NOT NULL DEFAULT false, driver_message_sent_at timestamp with time zone, driver_accepted_at timestamp with time zone, driver_km_initial integer, route_started_at timestamp with time zone, route_started_km integer, route_finished_at timestamp with time zone, route_finished_km integer, driver_whatsapp_state text, obs_financeiras text DEFAULT ''::text, driver_id uuid, solicitante_id uuid, centro_custo_id uuid, driver_template_message_id text, created_by uuid, created_by_name text, driver_flow_start_message_id text, driver_flow_finish_message_id text, financeiro_faturado_em timestamp with time zone, financeiro_recebido_em timestamp with time zone, repasse_pago boolean DEFAULT false, no_show boolean NOT NULL DEFAULT false, no_show_percentual smallint, is_freelance boolean NOT NULL DEFAULT false, tipo text NOT NULL DEFAULT 'os'::text, isento_valor_bruto boolean NOT NULL DEFAULT false, isento_custo boolean NOT NULL DEFAULT false, caixa_conta_id uuid);
CREATE TABLE IF NOT EXISTS public.os_cycle_reminders (id uuid NOT NULL DEFAULT gen_random_uuid(), cycle_id uuid NOT NULL, reminder_kind text NOT NULL, sent_at timestamp with time zone NOT NULL DEFAULT now(), metadata jsonb DEFAULT '{}'::jsonb);
CREATE TABLE IF NOT EXISTS public.os_driver_polls (id uuid NOT NULL DEFAULT gen_random_uuid(), os_id uuid NOT NULL, poll_id text NOT NULL, phone text NOT NULL, question text NOT NULL, options text[] NOT NULL, status text NOT NULL DEFAULT 'pending'::text, voted_option text, voted_at timestamp with time zone, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.os_financeiro_anexos (id uuid NOT NULL DEFAULT gen_random_uuid(), ordem_servico_id uuid NOT NULL, storage_path text NOT NULL, nome_arquivo text NOT NULL, mime_type text NOT NULL, tamanho_bytes bigint NOT NULL DEFAULT 0, tipo_documento text NOT NULL DEFAULT 'comprovante'::text, observacao text, created_by uuid, created_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.os_link_shortcuts (id uuid NOT NULL DEFAULT gen_random_uuid(), os_id uuid NOT NULL, slug text NOT NULL, created_at timestamp with time zone NOT NULL DEFAULT now(), type text DEFAULT 'driver'::text);
CREATE TABLE IF NOT EXISTS public.os_logs (id uuid NOT NULL DEFAULT gen_random_uuid(), os_id uuid NOT NULL, type text NOT NULL, actor_name text NOT NULL DEFAULT 'Sistema'::text, actor_id uuid, description text NOT NULL, metadata jsonb DEFAULT '{}'::jsonb, created_at timestamp with time zone NOT NULL DEFAULT now(), actor_avatar_url text);
CREATE TABLE IF NOT EXISTS public.os_logs_sistema_backup_20260614 (id uuid, os_id uuid, type text, actor_name text, actor_id uuid, description text, metadata jsonb, created_at timestamp with time zone, actor_avatar_url text);
CREATE TABLE IF NOT EXISTS public.os_operational_cycles (id uuid NOT NULL DEFAULT gen_random_uuid(), ordem_servico_id uuid NOT NULL, itinerary_index integer NOT NULL, sequence_order integer NOT NULL, kind text NOT NULL, ordinal integer NOT NULL, title text NOT NULL, state text NOT NULL, message_sent_at timestamp with time zone, accepted_at timestamp with time zone, started_at timestamp with time zone, finished_at timestamp with time zone, km_initial integer, km_final integer, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now(), message_sent_by_id uuid);
CREATE TABLE IF NOT EXISTS public.os_passenger_confirmations (id uuid NOT NULL DEFAULT gen_random_uuid(), os_id uuid NOT NULL, passageiro_id uuid, token uuid NOT NULL DEFAULT gen_random_uuid(), aceito boolean DEFAULT false, aceito_em timestamp with time zone, created_at timestamp with time zone DEFAULT now(), template_message_id text);
CREATE TABLE IF NOT EXISTS public.os_waypoint_comments (id uuid NOT NULL DEFAULT gen_random_uuid(), ordem_servico_id uuid NOT NULL, waypoint_position integer NOT NULL, waypoint_label text NOT NULL, comment text NOT NULL, created_at timestamp with time zone DEFAULT now());
CREATE TABLE IF NOT EXISTS public.os_waypoint_passengers (id uuid NOT NULL DEFAULT gen_random_uuid(), waypoint_id uuid NOT NULL, passageiro_id uuid, created_at timestamp with time zone DEFAULT now());
CREATE TABLE IF NOT EXISTS public.os_waypoints (id uuid NOT NULL DEFAULT gen_random_uuid(), ordem_servico_id uuid NOT NULL, "position" integer NOT NULL DEFAULT 0, label text NOT NULL DEFAULT ''::text, lat double precision, lng double precision, created_at timestamp with time zone DEFAULT now(), comment text NOT NULL DEFAULT ''::text, hora time without time zone, data date, itinerary_index integer);
CREATE TABLE IF NOT EXISTS public.parceiros_contatos (id uuid NOT NULL DEFAULT gen_random_uuid(), parceiro_id uuid NOT NULL, setor text NOT NULL, celular text NOT NULL, email text, responsavel text NOT NULL, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.parceiros_filiais (id uuid NOT NULL DEFAULT gen_random_uuid(), parceiro_id uuid NOT NULL, rotulo text NOT NULL, endereco_completo text NOT NULL, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.parceiros_servico (id uuid NOT NULL DEFAULT gen_random_uuid(), nome character varying(255) NOT NULL, tipo character varying(100) NOT NULL DEFAULT 'Transportadora'::character varying, pessoa_tipo character varying(10) NOT NULL DEFAULT 'juridica'::character varying, documento character varying(20), razao_social_ou_nome_completo character varying(255), telefone character varying(20), email character varying(255), endereco text, cidade character varying(100), estado character varying(2), contato_nome character varying(255), contato_telefone character varying(20), contato_email character varying(255), created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), search_index text DEFAULT lower((((((((((((((COALESCE(nome, ''::character varying))::text || ' '::text) || (COALESCE(razao_social_ou_nome_completo, ''::character varying))::text) || ' '::text) || (COALESCE(documento, ''::character varying))::text) || ' '::text) || (COALESCE(telefone, ''::character varying))::text) || ' '::text) || (COALESCE(email, ''::character varying))::text) || ' '::text) || (COALESCE(contato_nome, ''::character varying))::text) || ' '::text) || (COALESCE(cidade, ''::character varying))::text)), status text NOT NULL DEFAULT 'ativo'::text, arquivado boolean DEFAULT false);
CREATE TABLE IF NOT EXISTS public.passageiro_enderecos (id uuid NOT NULL DEFAULT gen_random_uuid(), passageiro_id uuid NOT NULL, rotulo text NOT NULL DEFAULT 'Principal'::text, endereco_completo text NOT NULL, referencia text, created_at timestamp with time zone DEFAULT now());
CREATE TABLE IF NOT EXISTS public.passageiros (id uuid NOT NULL DEFAULT gen_random_uuid(), nome_completo text NOT NULL, email text DEFAULT ''::text, celular text DEFAULT ''::text, cpf text DEFAULT ''::text, created_at timestamp with time zone DEFAULT now(), notificar boolean, genero character varying(50) DEFAULT NULL::character varying, arquivado boolean DEFAULT false);
CREATE TABLE IF NOT EXISTS public.pending_whatsapp_messages (id uuid NOT NULL DEFAULT gen_random_uuid(), phone text NOT NULL, template_name text, template_components jsonb, message_text text, message_type text NOT NULL, os_id uuid, retry_count integer NOT NULL DEFAULT 0, max_retries integer NOT NULL DEFAULT 3, last_error text, next_retry_at timestamp with time zone, status text NOT NULL DEFAULT 'pending'::text, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.solicitantes (id uuid NOT NULL DEFAULT gen_random_uuid(), nome text NOT NULL, cliente_id uuid NOT NULL, created_at timestamp with time zone DEFAULT now(), centro_custo_id uuid, arquivado boolean DEFAULT false);
CREATE TABLE IF NOT EXISTS public.system_announcements (id uuid NOT NULL DEFAULT gen_random_uuid(), title text NOT NULL, message text NOT NULL, type text NOT NULL DEFAULT 'info'::text, is_active boolean NOT NULL DEFAULT true, created_by uuid, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now(), expires_at timestamp with time zone, subtitle text);
CREATE TABLE IF NOT EXISTS public.system_pendencias (id uuid NOT NULL DEFAULT gen_random_uuid(), source_type text NOT NULL, source_id uuid NOT NULL, motivo text NOT NULL, protocolo text NOT NULL DEFAULT ''::text, os_number text NOT NULL DEFAULT ''::text, cliente_nome text NOT NULL DEFAULT 'Cliente não informado'::text, data text NOT NULL DEFAULT ''::text, user_id uuid, age_days integer, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), itinerary_index integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS public.user_presence (user_id uuid NOT NULL, status text NOT NULL DEFAULT 'offline'::text, last_seen_at timestamp with time zone NOT NULL DEFAULT now(), last_activity_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.user_roles (id uuid NOT NULL, nome text NOT NULL DEFAULT ''::text, tipo_usuario text NOT NULL DEFAULT 'interno'::text, categoria text NOT NULL DEFAULT 'operador'::text, empresa_id uuid, created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()), updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()), avatar_url text, specific_permissions jsonb DEFAULT '{}'::jsonb);
CREATE TABLE IF NOT EXISTS public.vehicle_km_history (id uuid NOT NULL DEFAULT gen_random_uuid(), veiculo_id uuid NOT NULL, os_id uuid, km_value numeric(12,2) NOT NULL, km_type text NOT NULL, driver_name text, recorded_via text NOT NULL DEFAULT 'webhook'::text, created_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.vehicle_km_odometer (id uuid NOT NULL DEFAULT gen_random_uuid(), veiculo_id uuid NOT NULL, last_km numeric(12,2) NOT NULL DEFAULT 0, last_km_type text NOT NULL DEFAULT 'initial'::text, last_os_id uuid, last_recorded_at timestamp with time zone NOT NULL DEFAULT now(), created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.veiculos (id uuid NOT NULL DEFAULT gen_random_uuid(), placa character varying(10) NOT NULL, renavam character varying(11), modelo character varying(100) NOT NULL, marca character varying(100) NOT NULL, ano integer NOT NULL, cor character varying(30), tipo character varying(20) NOT NULL DEFAULT 'carro'::character varying, status character varying(20) NOT NULL DEFAULT 'ativo'::character varying, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), arquivado boolean DEFAULT false);
CREATE TABLE IF NOT EXISTS public.webhook_flow_events (id uuid NOT NULL DEFAULT gen_random_uuid(), context_id text NOT NULL, flow_type text NOT NULL, os_id uuid, cycle_index integer NOT NULL, km_value numeric(10,2), payload jsonb, processed_at timestamp with time zone NOT NULL DEFAULT now(), created_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.webhook_logs (id uuid NOT NULL DEFAULT gen_random_uuid(), created_at timestamp with time zone DEFAULT now(), source text, event_type text, payload jsonb);
CREATE TABLE IF NOT EXISTS public.webhook_metrics (id uuid NOT NULL DEFAULT gen_random_uuid(), event_type text NOT NULL, os_id uuid, phone text, duration_ms integer, success boolean NOT NULL, error_message text, metadata jsonb, created_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.webhook_rate_limits (id uuid NOT NULL DEFAULT gen_random_uuid(), phone text NOT NULL, event_type text NOT NULL, count integer NOT NULL DEFAULT 1, window_start timestamp with time zone NOT NULL DEFAULT now(), created_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.whatsapp_message_tracking (id uuid NOT NULL DEFAULT gen_random_uuid(), os_id uuid NOT NULL, message_id text NOT NULL, phone text NOT NULL, motorista text NOT NULL, cycle_index integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'sent'::text, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.whatsapp_status (id uuid NOT NULL DEFAULT gen_random_uuid(), instance_name text NOT NULL, state text NOT NULL DEFAULT 'close'::text, owner_jid text, updated_at timestamp with time zone NOT NULL DEFAULT now());

-- CONSTRAINTS
ALTER TABLE public.announcement_dismissals ADD CONSTRAINT announcement_dismissals_user_id_announcement_id_key UNIQUE (user_id, announcement_id);
ALTER TABLE public.announcement_dismissals ADD CONSTRAINT announcement_dismissals_pkey PRIMARY KEY (id);
ALTER TABLE public.announcement_dismissals ADD CONSTRAINT announcement_dismissals_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES system_announcements(id) ON DELETE CASCADE;
ALTER TABLE public.announcement_dismissals ADD CONSTRAINT announcement_dismissals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.app_notification_reads ADD CONSTRAINT app_notification_reads_pkey PRIMARY KEY (notification_id, user_id);
ALTER TABLE public.app_notification_reads ADD CONSTRAINT app_notification_reads_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES app_notifications(id) ON DELETE CASCADE;
ALTER TABLE public.app_notification_reads ADD CONSTRAINT app_notification_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_category_check CHECK ((category = ANY (ARRAY['sistema'::text, 'motorista'::text])));
ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_target_audience_check CHECK ((target_audience = ANY (ARRAY['interno'::text, 'gestor'::text, 'all'::text])));
ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_type_check CHECK ((type = ANY (ARRAY['success'::text, 'info'::text, 'warning'::text, 'error'::text])));
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);
ALTER TABLE public.app_versions ADD CONSTRAINT app_versions_pkey PRIMARY KEY (id);
ALTER TABLE public.bancos ADD CONSTRAINT bancos_pkey PRIMARY KEY (id);
ALTER TABLE public.caixa_contas ADD CONSTRAINT caixa_contas_pkey PRIMARY KEY (id);
ALTER TABLE public.caixa_contas ADD CONSTRAINT caixa_contas_banco_id_fkey FOREIGN KEY (banco_id) REFERENCES bancos(id) ON DELETE SET NULL;
ALTER TABLE public.caixa_contas ADD CONSTRAINT caixa_contas_tipo_check CHECK ((tipo = ANY (ARRAY['caixa'::text, 'banco'::text, 'pix'::text, 'carteira'::text])));
ALTER TABLE public.caixa_lancamentos ADD CONSTRAINT caixa_lancamentos_pkey PRIMARY KEY (id);
ALTER TABLE public.caixa_lancamentos ADD CONSTRAINT caixa_lancamentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE public.caixa_lancamentos ADD CONSTRAINT caixa_lancamentos_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES caixa_contas(id) ON DELETE RESTRICT;
ALTER TABLE public.caixa_lancamentos ADD CONSTRAINT caixa_lancamentos_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;
ALTER TABLE public.caixa_lancamentos ADD CONSTRAINT caixa_lancamentos_os_id_fkey FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
ALTER TABLE public.caixa_lancamentos ADD CONSTRAINT caixa_lancamentos_forma_pagamento_check CHECK ((forma_pagamento = ANY (ARRAY['pix'::text, 'dinheiro'::text, 'cartao_credito'::text, 'cartao_debito'::text, 'transferencia'::text, 'boleto'::text, 'outro'::text])));
ALTER TABLE public.caixa_lancamentos ADD CONSTRAINT caixa_lancamentos_origem_check CHECK ((origem = ANY (ARRAY['manual'::text, 'os_recebimento'::text, 'os_repasse'::text])));
ALTER TABLE public.caixa_lancamentos ADD CONSTRAINT caixa_lancamentos_tipo_check CHECK ((tipo = ANY (ARRAY['entrada'::text, 'saida'::text])));
ALTER TABLE public.caixa_lancamentos ADD CONSTRAINT caixa_lancamentos_valor_check CHECK ((valor > (0)::numeric));
ALTER TABLE public.centros_custo ADD CONSTRAINT centros_custo_nome_cliente_unique UNIQUE (nome, cliente_id);
ALTER TABLE public.centros_custo ADD CONSTRAINT centros_custo_pkey PRIMARY KEY (id);
ALTER TABLE public.centros_custo ADD CONSTRAINT centros_custo_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE public.chat_conversations ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_conversations ADD CONSTRAINT chat_conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.chat_conversations ADD CONSTRAINT chat_conversations_type_check CHECK ((type = ANY (ARRAY['direct'::text, 'group'::text])));
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES chat_messages(id) ON DELETE SET NULL;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES user_roles(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_message_type_check CHECK ((message_type = ANY (ARRAY['text'::text, 'image'::text, 'file'::text, 'system'::text])));
ALTER TABLE public.chat_participants ADD CONSTRAINT chat_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);
ALTER TABLE public.chat_participants ADD CONSTRAINT chat_participants_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_participants ADD CONSTRAINT chat_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE;
ALTER TABLE public.chat_participants ADD CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_roles(id) ON DELETE CASCADE;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_nome_unique UNIQUE (nome);
ALTER TABLE public.clientes ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);
ALTER TABLE public.docagem_instancias ADD CONSTRAINT docagem_instancias_docagem_id_data_key UNIQUE (docagem_id, data);
ALTER TABLE public.docagem_instancias ADD CONSTRAINT docagem_instancias_pkey PRIMARY KEY (id);
ALTER TABLE public.docagem_instancias ADD CONSTRAINT docagem_instancias_docagem_id_fkey FOREIGN KEY (docagem_id) REFERENCES docagens(id) ON DELETE CASCADE;
ALTER TABLE public.docagem_instancias ADD CONSTRAINT docagem_instancias_finalizada_por_fkey FOREIGN KEY (finalizada_por) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.docagem_instancias ADD CONSTRAINT docagem_instancias_motorista_id_fkey FOREIGN KEY (motorista_id) REFERENCES drivers(id) ON DELETE SET NULL;
ALTER TABLE public.docagem_instancias ADD CONSTRAINT docagem_instancias_veiculo_id_fkey FOREIGN KEY (veiculo_id) REFERENCES veiculos(id) ON DELETE SET NULL;
ALTER TABLE public.docagem_instancias ADD CONSTRAINT docagem_instancias_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'andamento'::text, 'finalizada'::text, 'excluida'::text])));
ALTER TABLE public.docagem_lancamentos ADD CONSTRAINT docagem_lancamentos_pkey PRIMARY KEY (id);
ALTER TABLE public.docagem_lancamentos ADD CONSTRAINT docagem_lancamentos_centro_custo_id_fkey FOREIGN KEY (centro_custo_id) REFERENCES centros_custo(id) ON DELETE SET NULL;
ALTER TABLE public.docagem_lancamentos ADD CONSTRAINT docagem_lancamentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE public.docagem_lancamentos ADD CONSTRAINT docagem_lancamentos_docagem_instancia_id_fkey FOREIGN KEY (docagem_instancia_id) REFERENCES docagem_instancias(id) ON DELETE CASCADE;
ALTER TABLE public.docagem_lancamentos ADD CONSTRAINT docagem_lancamentos_motorista_id_fkey FOREIGN KEY (motorista_id) REFERENCES drivers(id) ON DELETE SET NULL;
ALTER TABLE public.docagem_lancamentos ADD CONSTRAINT docagem_lancamentos_status_check CHECK ((status = ANY (ARRAY['previsto'::text, 'realizado'::text])));
ALTER TABLE public.docagens ADD CONSTRAINT docagens_pkey PRIMARY KEY (id);
ALTER TABLE public.docagens ADD CONSTRAINT docagens_centro_custo_id_fkey FOREIGN KEY (centro_custo_id) REFERENCES centros_custo(id) ON DELETE SET NULL;
ALTER TABLE public.docagens ADD CONSTRAINT docagens_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE public.docagens ADD CONSTRAINT docagens_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.docagens ADD CONSTRAINT docagens_motorista_id_fkey FOREIGN KEY (motorista_id) REFERENCES drivers(id) ON DELETE SET NULL;
ALTER TABLE public.docagens ADD CONSTRAINT docagens_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES solicitantes(id) ON DELETE SET NULL;
ALTER TABLE public.docagens ADD CONSTRAINT docagens_veiculo_id_fkey FOREIGN KEY (veiculo_id) REFERENCES veiculos(id) ON DELETE SET NULL;
ALTER TABLE public.docagens ADD CONSTRAINT docagens_status_check CHECK ((status = ANY (ARRAY['ativa'::text, 'cancelada'::text, 'finalizada'::text])));
ALTER TABLE public.driver_documents ADD CONSTRAINT driver_documents_pkey PRIMARY KEY (id);
ALTER TABLE public.driver_documents ADD CONSTRAINT driver_documents_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE;
ALTER TABLE public.driver_vehicles ADD CONSTRAINT unique_driver_vehicle UNIQUE (driver_id, vehicle_id);
ALTER TABLE public.driver_vehicles ADD CONSTRAINT driver_vehicles_pkey PRIMARY KEY (id);
ALTER TABLE public.driver_vehicles ADD CONSTRAINT driver_vehicles_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE;
ALTER TABLE public.driver_vehicles ADD CONSTRAINT driver_vehicles_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES veiculos(id) ON DELETE CASCADE;
ALTER TABLE public.drivers ADD CONSTRAINT drivers_cpf_key UNIQUE (cpf);
ALTER TABLE public.drivers ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);
ALTER TABLE public.drivers ADD CONSTRAINT drivers_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES parceiros_servico(id) ON DELETE SET NULL;
ALTER TABLE public.drivers ADD CONSTRAINT drivers_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES veiculos(id) ON DELETE SET NULL;
ALTER TABLE public.drivers ADD CONSTRAINT drivers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));
ALTER TABLE public.drivers ADD CONSTRAINT drivers_vinculo_tipo_check CHECK (((vinculo_tipo)::text = ANY ((ARRAY['interno'::character varying, 'parceiro'::character varying, 'autonomo'::character varying])::text[])));
ALTER TABLE public.financial_config_history ADD CONSTRAINT financial_config_history_pkey PRIMARY KEY (id);
ALTER TABLE public.frontend_error_logs ADD CONSTRAINT frontend_error_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.frontend_error_logs ADD CONSTRAINT frontend_error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.frontend_error_logs ADD CONSTRAINT frontend_error_logs_error_level_check CHECK ((error_level = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'critical'::text])));
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_protocolo_key UNIQUE (protocolo);
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_pkey PRIMARY KEY (id);
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_caixa_conta_id_fkey FOREIGN KEY (caixa_conta_id) REFERENCES caixa_contas(id) ON DELETE SET NULL;
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_centro_custo_id_fkey FOREIGN KEY (centro_custo_id) REFERENCES centros_custo(id) ON DELETE SET NULL;
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES solicitantes(id) ON DELETE SET NULL;
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_veiculo_id_fkey FOREIGN KEY (veiculo_id) REFERENCES veiculos(id);
ALTER TABLE public.ordens_servico ADD CONSTRAINT chk_ordens_servico_tipo CHECK ((tipo = ANY (ARRAY['os'::text, 'freelance'::text, 'rascunho'::text])));
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_no_show_percentual_check CHECK (((no_show_percentual IS NULL) OR (no_show_percentual = ANY (ARRAY[50, 100]))));
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_status_financeiro_check CHECK ((status_financeiro = ANY (ARRAY['Pendente'::text, 'Faturado'::text, 'Recebido'::text, 'Pago'::text, 'Rascunho'::text])));
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_status_operacional_check CHECK ((status_operacional = ANY (ARRAY['Pendente'::text, 'Aguardando'::text, 'Em Rota'::text, 'Andamento'::text, 'Finalizado'::text, 'Cancelado'::text, 'Rascunho'::text])));
ALTER TABLE public.os_cycle_reminders ADD CONSTRAINT os_cycle_reminders_cycle_id_reminder_kind_key UNIQUE (cycle_id, reminder_kind);
ALTER TABLE public.os_cycle_reminders ADD CONSTRAINT os_cycle_reminders_pkey PRIMARY KEY (id);
ALTER TABLE public.os_cycle_reminders ADD CONSTRAINT os_cycle_reminders_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES os_operational_cycles(id) ON DELETE CASCADE;
ALTER TABLE public.os_driver_polls ADD CONSTRAINT os_driver_polls_pkey PRIMARY KEY (id);
ALTER TABLE public.os_driver_polls ADD CONSTRAINT os_driver_polls_os_id_fkey FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
ALTER TABLE public.os_financeiro_anexos ADD CONSTRAINT os_financeiro_anexos_storage_path_key UNIQUE (storage_path);
ALTER TABLE public.os_financeiro_anexos ADD CONSTRAINT os_financeiro_anexos_pkey PRIMARY KEY (id);
ALTER TABLE public.os_financeiro_anexos ADD CONSTRAINT os_financeiro_anexos_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.os_financeiro_anexos ADD CONSTRAINT os_financeiro_anexos_ordem_servico_id_fkey FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
ALTER TABLE public.os_link_shortcuts ADD CONSTRAINT os_link_shortcuts_slug_key UNIQUE (slug);
ALTER TABLE public.os_link_shortcuts ADD CONSTRAINT os_link_shortcuts_pkey PRIMARY KEY (id);
ALTER TABLE public.os_link_shortcuts ADD CONSTRAINT os_link_shortcuts_type_check CHECK ((type = ANY (ARRAY['driver'::text, 'passenger'::text])));
ALTER TABLE public.os_logs ADD CONSTRAINT os_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.os_logs ADD CONSTRAINT os_logs_os_id_fkey FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
ALTER TABLE public.os_logs ADD CONSTRAINT os_logs_type_check CHECK ((type = ANY (ARRAY['create'::text, 'update'::text, 'status_change'::text, 'archive'::text, 'unarchive'::text, 'driver_accept'::text, 'driver_start'::text, 'driver_finish'::text, 'driver_notify'::text, 'driver_delivered'::text, 'passenger_notify'::text, 'passenger_confirm'::text, 'comment'::text, 'driver_delay'::text, 'driver_edit_ack'::text])));
ALTER TABLE public.os_operational_cycles ADD CONSTRAINT os_operational_cycles_pkey PRIMARY KEY (id);
ALTER TABLE public.os_operational_cycles ADD CONSTRAINT os_operational_cycles_message_sent_by_id_fkey FOREIGN KEY (message_sent_by_id) REFERENCES user_roles(id) ON DELETE SET NULL;
ALTER TABLE public.os_operational_cycles ADD CONSTRAINT os_operational_cycles_ordem_servico_id_fkey FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
ALTER TABLE public.os_operational_cycles ADD CONSTRAINT os_operational_cycles_kind_check CHECK ((kind = ANY (ARRAY['itinerary'::text, 'return'::text])));
ALTER TABLE public.os_operational_cycles ADD CONSTRAINT os_operational_cycles_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'awaiting_accept'::text, 'awaiting_start'::text, 'awaiting_km_start'::text, 'awaiting_finish'::text, 'awaiting_km_finish'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE public.os_passenger_confirmations ADD CONSTRAINT os_passenger_confirmations_token_key UNIQUE (token);
ALTER TABLE public.os_passenger_confirmations ADD CONSTRAINT unique_os_passageiro UNIQUE (os_id, passageiro_id);
ALTER TABLE public.os_passenger_confirmations ADD CONSTRAINT os_passenger_confirmations_pkey PRIMARY KEY (id);
ALTER TABLE public.os_passenger_confirmations ADD CONSTRAINT os_passenger_confirmations_os_id_fkey FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
ALTER TABLE public.os_passenger_confirmations ADD CONSTRAINT os_passenger_confirmations_passageiro_id_fkey FOREIGN KEY (passageiro_id) REFERENCES passageiros(id) ON DELETE SET NULL;
ALTER TABLE public.os_waypoint_comments ADD CONSTRAINT os_waypoint_comments_pkey PRIMARY KEY (id);
ALTER TABLE public.os_waypoint_comments ADD CONSTRAINT os_waypoint_comments_ordem_servico_id_fkey FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
ALTER TABLE public.os_waypoint_passengers ADD CONSTRAINT os_waypoint_passengers_pkey PRIMARY KEY (id);
ALTER TABLE public.os_waypoint_passengers ADD CONSTRAINT os_waypoint_passengers_passageiro_id_fkey FOREIGN KEY (passageiro_id) REFERENCES passageiros(id) ON DELETE SET NULL;
ALTER TABLE public.os_waypoint_passengers ADD CONSTRAINT os_waypoint_passengers_waypoint_id_fkey FOREIGN KEY (waypoint_id) REFERENCES os_waypoints(id) ON DELETE CASCADE;
ALTER TABLE public.os_waypoints ADD CONSTRAINT os_waypoints_pkey PRIMARY KEY (id);
ALTER TABLE public.os_waypoints ADD CONSTRAINT os_waypoints_ordem_servico_id_fkey FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
ALTER TABLE public.parceiros_contatos ADD CONSTRAINT parceiros_contatos_pkey PRIMARY KEY (id);
ALTER TABLE public.parceiros_contatos ADD CONSTRAINT parceiros_contatos_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES parceiros_servico(id) ON DELETE CASCADE;
ALTER TABLE public.parceiros_filiais ADD CONSTRAINT parceiros_filiais_pkey PRIMARY KEY (id);
ALTER TABLE public.parceiros_filiais ADD CONSTRAINT parceiros_filiais_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES parceiros_servico(id) ON DELETE CASCADE;
ALTER TABLE public.parceiros_servico ADD CONSTRAINT parceiros_servico_pkey PRIMARY KEY (id);
ALTER TABLE public.parceiros_servico ADD CONSTRAINT parceiros_servico_pessoa_tipo_check CHECK (((pessoa_tipo)::text = ANY ((ARRAY['fisica'::character varying, 'juridica'::character varying])::text[])));
ALTER TABLE public.parceiros_servico ADD CONSTRAINT parceiros_servico_status_check CHECK ((status = ANY (ARRAY['ativo'::text, 'inativo'::text])));
ALTER TABLE public.passageiro_enderecos ADD CONSTRAINT passageiro_enderecos_pkey PRIMARY KEY (id);
ALTER TABLE public.passageiro_enderecos ADD CONSTRAINT passageiro_enderecos_passageiro_id_fkey FOREIGN KEY (passageiro_id) REFERENCES passageiros(id) ON DELETE CASCADE;
ALTER TABLE public.passageiros ADD CONSTRAINT passageiros_cpf_unique UNIQUE (cpf);
ALTER TABLE public.passageiros ADD CONSTRAINT passageiros_pkey PRIMARY KEY (id);
ALTER TABLE public.pending_whatsapp_messages ADD CONSTRAINT pending_whatsapp_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.pending_whatsapp_messages ADD CONSTRAINT pending_whatsapp_messages_os_id_fkey FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
ALTER TABLE public.pending_whatsapp_messages ADD CONSTRAINT pending_whatsapp_messages_message_type_check CHECK ((message_type = ANY (ARRAY['template'::text, 'text'::text])));
ALTER TABLE public.pending_whatsapp_messages ADD CONSTRAINT pending_whatsapp_messages_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text])));
ALTER TABLE public.solicitantes ADD CONSTRAINT solicitantes_nome_cliente_unique UNIQUE (nome, cliente_id);
ALTER TABLE public.solicitantes ADD CONSTRAINT solicitantes_pkey PRIMARY KEY (id);
ALTER TABLE public.solicitantes ADD CONSTRAINT solicitantes_centro_custo_id_fkey FOREIGN KEY (centro_custo_id) REFERENCES centros_custo(id) ON DELETE SET NULL;
ALTER TABLE public.solicitantes ADD CONSTRAINT solicitantes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE public.system_announcements ADD CONSTRAINT system_announcements_pkey PRIMARY KEY (id);
ALTER TABLE public.system_announcements ADD CONSTRAINT system_announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.system_announcements ADD CONSTRAINT system_announcements_type_check CHECK ((type = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'success'::text])));
ALTER TABLE public.system_pendencias ADD CONSTRAINT system_pendencias_pkey PRIMARY KEY (id);
ALTER TABLE public.system_pendencias ADD CONSTRAINT system_pendencias_motivo_check CHECK ((motivo = ANY (ARRAY['sem_valor'::text, 'atrasada'::text, 'rascunho'::text, 'docagem'::text])));
ALTER TABLE public.system_pendencias ADD CONSTRAINT system_pendencias_source_type_check CHECK ((source_type = ANY (ARRAY['os'::text, 'docagem'::text])));
ALTER TABLE public.user_presence ADD CONSTRAINT user_presence_pkey PRIMARY KEY (user_id);
ALTER TABLE public.user_presence ADD CONSTRAINT user_presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_roles(id) ON DELETE CASCADE;
ALTER TABLE public.user_presence ADD CONSTRAINT user_presence_status_check CHECK ((status = ANY (ARRAY['online'::text, 'offline'::text])));
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_categoria_check CHECK ((categoria = ANY (ARRAY['administrador'::text, 'gestor'::text, 'financeiro'::text, 'operador'::text, 'jovem aprendiz'::text])));
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_tipo_usuario_check CHECK ((tipo_usuario = ANY (ARRAY['interno'::text, 'gestor'::text])));
ALTER TABLE public.vehicle_km_history ADD CONSTRAINT vehicle_km_history_pkey PRIMARY KEY (id);
ALTER TABLE public.vehicle_km_history ADD CONSTRAINT vehicle_km_history_os_id_fkey FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
ALTER TABLE public.vehicle_km_history ADD CONSTRAINT vehicle_km_history_veiculo_id_fkey FOREIGN KEY (veiculo_id) REFERENCES veiculos(id) ON DELETE CASCADE;
ALTER TABLE public.vehicle_km_history ADD CONSTRAINT vehicle_km_history_km_type_check CHECK ((km_type = ANY (ARRAY['initial'::text, 'final'::text])));
ALTER TABLE public.vehicle_km_history ADD CONSTRAINT vehicle_km_history_recorded_via_check CHECK ((recorded_via = ANY (ARRAY['webhook'::text, 'manual'::text, 'import'::text])));
ALTER TABLE public.vehicle_km_odometer ADD CONSTRAINT vehicle_km_odometer_unique_vehicle UNIQUE (veiculo_id);
ALTER TABLE public.vehicle_km_odometer ADD CONSTRAINT vehicle_km_odometer_pkey PRIMARY KEY (id);
ALTER TABLE public.vehicle_km_odometer ADD CONSTRAINT vehicle_km_odometer_last_os_id_fkey FOREIGN KEY (last_os_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
ALTER TABLE public.vehicle_km_odometer ADD CONSTRAINT vehicle_km_odometer_veiculo_id_fkey FOREIGN KEY (veiculo_id) REFERENCES veiculos(id) ON DELETE CASCADE;
ALTER TABLE public.vehicle_km_odometer ADD CONSTRAINT vehicle_km_odometer_last_km_type_check CHECK ((last_km_type = ANY (ARRAY['initial'::text, 'final'::text])));
ALTER TABLE public.veiculos ADD CONSTRAINT veiculos_placa_key UNIQUE (placa);
ALTER TABLE public.veiculos ADD CONSTRAINT veiculos_pkey PRIMARY KEY (id);
ALTER TABLE public.veiculos ADD CONSTRAINT veiculos_status_check CHECK (((status)::text = ANY ((ARRAY['ativo'::character varying, 'inativo'::character varying, 'manutencao'::character varying])::text[])));
ALTER TABLE public.veiculos ADD CONSTRAINT veiculos_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['carro'::character varying, 'van'::character varying, 'onibus'::character varying, 'moto'::character varying, 'caminhao'::character varying, 'outro'::character varying])::text[])));
ALTER TABLE public.webhook_flow_events ADD CONSTRAINT webhook_flow_events_unique_context UNIQUE (context_id, flow_type);
ALTER TABLE public.webhook_flow_events ADD CONSTRAINT webhook_flow_events_pkey PRIMARY KEY (id);
ALTER TABLE public.webhook_flow_events ADD CONSTRAINT webhook_flow_events_os_id_fkey FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
ALTER TABLE public.webhook_flow_events ADD CONSTRAINT webhook_flow_events_flow_type_check CHECK ((flow_type = ANY (ARRAY['start'::text, 'finish'::text])));
ALTER TABLE public.webhook_logs ADD CONSTRAINT webhook_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.webhook_metrics ADD CONSTRAINT webhook_metrics_pkey PRIMARY KEY (id);
ALTER TABLE public.webhook_metrics ADD CONSTRAINT webhook_metrics_os_id_fkey FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
ALTER TABLE public.webhook_rate_limits ADD CONSTRAINT webhook_rate_limits_unique_window UNIQUE (phone, event_type, window_start);
ALTER TABLE public.webhook_rate_limits ADD CONSTRAINT webhook_rate_limits_pkey PRIMARY KEY (id);
ALTER TABLE public.whatsapp_message_tracking ADD CONSTRAINT whatsapp_message_tracking_pkey PRIMARY KEY (id);
ALTER TABLE public.whatsapp_message_tracking ADD CONSTRAINT whatsapp_message_tracking_os_id_fkey FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_message_tracking ADD CONSTRAINT whatsapp_message_tracking_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text, 'failed'::text])));
ALTER TABLE public.whatsapp_status ADD CONSTRAINT whatsapp_status_instance_name_key UNIQUE (instance_name);
ALTER TABLE public.whatsapp_status ADD CONSTRAINT whatsapp_status_pkey PRIMARY KEY (id);

-- INDEXES
CREATE INDEX app_versions_deployed_at_idx ON public.app_versions USING btree (deployed_at DESC);
CREATE UNIQUE INDEX clientes_nome_unique_normalized ON public.clientes USING btree (lower(btrim(nome))) WHERE (btrim(nome) <> ''::text);
CREATE UNIQUE INDEX drivers_cnh_unique_normalized ON public.drivers USING btree (regexp_replace(COALESCE(cnh, ''::text), '\\D'::text, ''::text, 'g'::text)) WHERE (regexp_replace(COALESCE(cnh, ''::text), '\\D'::text, ''::text, 'g'::text) <> ''::text);
CREATE UNIQUE INDEX drivers_cpf_unique_normalized ON public.drivers USING btree (regexp_replace(COALESCE(cpf, ''::text), '\\D'::text, ''::text, 'g'::text)) WHERE (regexp_replace(COALESCE(cpf, ''::text), '\\D'::text, ''::text, 'g'::text) <> ''::text);
CREATE UNIQUE INDEX drivers_name_unique_normalized ON public.drivers USING btree (lower(btrim(name))) WHERE (btrim(name) <> ''::text);
CREATE INDEX idx_announcement_dismissals_announcement ON public.announcement_dismissals USING btree (announcement_id);
CREATE INDEX idx_announcement_dismissals_user ON public.announcement_dismissals USING btree (user_id);
CREATE INDEX idx_app_notification_reads_notification_id ON public.app_notification_reads USING btree (notification_id);
CREATE INDEX idx_app_notification_reads_user_id ON public.app_notification_reads USING btree (user_id);
CREATE INDEX idx_app_notifications_category_created_at ON public.app_notifications USING btree (category, created_at DESC);
CREATE INDEX idx_app_notifications_created_by ON public.app_notifications USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE UNIQUE INDEX idx_bancos_nome ON public.bancos USING btree (nome);
CREATE UNIQUE INDEX idx_bancos_sigla ON public.bancos USING btree (sigla);
CREATE INDEX idx_caixa_contas_ativa ON public.caixa_contas USING btree (ativa);
CREATE UNIQUE INDEX idx_caixa_contas_single_default ON public.caixa_contas USING btree (is_default) WHERE (is_default = true);
CREATE INDEX idx_caixa_lancamentos_cliente ON public.caixa_lancamentos USING btree (cliente_id) WHERE (cliente_id IS NOT NULL);
CREATE INDEX idx_caixa_lancamentos_conta ON public.caixa_lancamentos USING btree (conta_id);
CREATE INDEX idx_caixa_lancamentos_data ON public.caixa_lancamentos USING btree (data DESC);
CREATE INDEX idx_caixa_lancamentos_driver ON public.caixa_lancamentos USING btree (driver_id) WHERE (driver_id IS NOT NULL);
CREATE INDEX idx_caixa_lancamentos_origem ON public.caixa_lancamentos USING btree (origem);
CREATE INDEX idx_caixa_lancamentos_os ON public.caixa_lancamentos USING btree (os_id) WHERE (os_id IS NOT NULL);
CREATE UNIQUE INDEX idx_caixa_lancamentos_os_origem_unique ON public.caixa_lancamentos USING btree (os_id, origem) WHERE (origem = ANY (ARRAY['os_recebimento'::text, 'os_repasse'::text]));
CREATE INDEX idx_caixa_lancamentos_tipo ON public.caixa_lancamentos USING btree (tipo);
CREATE INDEX idx_chat_conversations_created_by ON public.chat_conversations USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX idx_chat_conversations_updated_at ON public.chat_conversations USING btree (updated_at DESC);
CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages USING btree (conversation_id, created_at DESC);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages USING btree (created_at DESC);
CREATE INDEX idx_chat_messages_sender_id ON public.chat_messages USING btree (sender_id);
CREATE INDEX idx_chat_participants_conversation_id ON public.chat_participants USING btree (conversation_id);
CREATE INDEX idx_chat_participants_user_id ON public.chat_participants USING btree (user_id);
CREATE INDEX idx_docagem_instancias_data ON public.docagem_instancias USING btree (data);
CREATE INDEX idx_docagem_instancias_docagem_data ON public.docagem_instancias USING btree (docagem_id, data);
CREATE INDEX idx_docagem_instancias_status ON public.docagem_instancias USING btree (status);
CREATE INDEX idx_docagem_lancamentos_instancia ON public.docagem_lancamentos USING btree (docagem_instancia_id);
CREATE INDEX idx_docagens_cliente ON public.docagens USING btree (cliente_id);
CREATE UNIQUE INDEX idx_docagens_protocolo ON public.docagens USING btree (protocolo) WHERE ((protocolo IS NOT NULL) AND (protocolo <> ''::text));
CREATE INDEX idx_docagens_status ON public.docagens USING btree (status);
CREATE INDEX idx_driver_documents_driver_id ON public.driver_documents USING btree (driver_id);
CREATE INDEX idx_driver_vehicles_driver_id ON public.driver_vehicles USING btree (driver_id);
CREATE INDEX idx_driver_vehicles_vehicle_id ON public.driver_vehicles USING btree (vehicle_id);
CREATE INDEX idx_drivers_avatar ON public.drivers USING btree (id) WHERE (avatar_url IS NOT NULL);
CREATE INDEX idx_drivers_cnh_trgm ON public.drivers USING gin (cnh gin_trgm_ops);
CREATE INDEX idx_drivers_cpf_trgm ON public.drivers USING gin (cpf gin_trgm_ops);
CREATE INDEX idx_drivers_name ON public.drivers USING btree (name);
CREATE INDEX idx_drivers_name_trgm ON public.drivers USING gin (name gin_trgm_ops);
CREATE INDEX idx_drivers_parceiro ON public.drivers USING btree (parceiro_id) WHERE (parceiro_id IS NOT NULL);
CREATE INDEX idx_drivers_parceiro_id ON public.drivers USING btree (parceiro_id) WHERE (parceiro_id IS NOT NULL);
CREATE INDEX idx_drivers_phone_trgm ON public.drivers USING gin (phone gin_trgm_ops);
CREATE INDEX idx_drivers_vehicle ON public.drivers USING btree (vehicle_id) WHERE (vehicle_id IS NOT NULL);
CREATE INDEX idx_drivers_vinculo ON public.drivers USING btree (vinculo_tipo);
CREATE INDEX idx_financial_config_history_key_date ON public.financial_config_history USING btree (config_key, effective_from DESC);
CREATE INDEX idx_frontend_logs_component ON public.frontend_error_logs USING gin (to_tsvector('portuguese'::regconfig, component));
CREATE INDEX idx_frontend_logs_created_at ON public.frontend_error_logs USING btree (created_at DESC);
CREATE INDEX idx_frontend_logs_level ON public.frontend_error_logs USING btree (error_level);
CREATE INDEX idx_frontend_logs_user_created ON public.frontend_error_logs USING btree (user_id, created_at DESC);
CREATE INDEX idx_frontend_logs_user_id ON public.frontend_error_logs USING btree (user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);
CREATE INDEX idx_notifications_read ON public.notifications USING btree (read);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX idx_ordens_servico_arquivado ON public.ordens_servico USING btree (arquivado);
CREATE INDEX idx_ordens_servico_arquivado_created_at ON public.ordens_servico USING btree (arquivado, created_at DESC);
CREATE INDEX idx_ordens_servico_arquivado_status ON public.ordens_servico USING btree (arquivado, status_operacional);
CREATE INDEX idx_ordens_servico_centro_custo_id ON public.ordens_servico USING btree (centro_custo_id);
CREATE INDEX idx_ordens_servico_cliente_id ON public.ordens_servico USING btree (cliente_id);
CREATE INDEX idx_ordens_servico_created_at ON public.ordens_servico USING btree (created_at DESC);
CREATE INDEX idx_ordens_servico_created_by ON public.ordens_servico USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX idx_ordens_servico_data ON public.ordens_servico USING btree (data);
CREATE INDEX idx_ordens_servico_driver_accepted_at ON public.ordens_servico USING btree (driver_accepted_at);
CREATE INDEX idx_ordens_servico_driver_flow_finish_msg_id ON public.ordens_servico USING btree (driver_flow_finish_message_id) WHERE (driver_flow_finish_message_id IS NOT NULL);
CREATE INDEX idx_ordens_servico_driver_flow_start_msg_id ON public.ordens_servico USING btree (driver_flow_start_message_id) WHERE (driver_flow_start_message_id IS NOT NULL);
CREATE INDEX idx_ordens_servico_driver_id ON public.ordens_servico USING btree (driver_id);
CREATE INDEX idx_ordens_servico_driver_template_msg_id ON public.ordens_servico USING btree (driver_template_message_id) WHERE (driver_template_message_id IS NOT NULL);
CREATE INDEX idx_ordens_servico_driver_whatsapp_state ON public.ordens_servico USING btree (driver_whatsapp_state) WHERE (driver_whatsapp_state IS NOT NULL);
CREATE INDEX idx_ordens_servico_financeiro_dashboard ON public.ordens_servico USING btree (arquivado, status_financeiro, data, cliente_id, centro_custo_id, driver_id);
CREATE INDEX idx_ordens_servico_os_number ON public.ordens_servico USING btree (os_number);
CREATE INDEX idx_ordens_servico_protocolo ON public.ordens_servico USING btree (protocolo);
CREATE INDEX idx_ordens_servico_repasse_pago ON public.ordens_servico USING btree (repasse_pago) WHERE (repasse_pago = true);
CREATE INDEX idx_ordens_servico_route_finished_at ON public.ordens_servico USING btree (route_finished_at);
CREATE INDEX idx_ordens_servico_route_started_at ON public.ordens_servico USING btree (route_started_at);
CREATE INDEX idx_ordens_servico_solicitante_id ON public.ordens_servico USING btree (solicitante_id);
CREATE INDEX idx_ordens_servico_status_financeiro ON public.ordens_servico USING btree (status_financeiro);
CREATE INDEX idx_ordens_servico_status_operacional ON public.ordens_servico USING btree (status_operacional);
CREATE INDEX idx_os_caixa_conta ON public.ordens_servico USING btree (caixa_conta_id) WHERE (caixa_conta_id IS NOT NULL);
CREATE INDEX idx_os_cycle_reminders_cycle_id ON public.os_cycle_reminders USING btree (cycle_id);
CREATE INDEX idx_os_driver_polls_os_id ON public.os_driver_polls USING btree (os_id);
CREATE INDEX idx_os_driver_polls_poll_id ON public.os_driver_polls USING btree (poll_id);
CREATE INDEX idx_os_financeiro_anexos_ordem_servico_created_at ON public.os_financeiro_anexos USING btree (ordem_servico_id, created_at DESC);
CREATE UNIQUE INDEX idx_os_link_shortcuts_os_id ON public.os_link_shortcuts USING btree (os_id);
CREATE UNIQUE INDEX idx_os_link_shortcuts_slug ON public.os_link_shortcuts USING btree (slug);
CREATE INDEX idx_os_logs_created_at ON public.os_logs USING btree (created_at DESC);
CREATE INDEX idx_os_logs_os_id ON public.os_logs USING btree (os_id);
CREATE UNIQUE INDEX idx_os_operational_cycles_os_itinerary_index ON public.os_operational_cycles USING btree (ordem_servico_id, itinerary_index);
CREATE INDEX idx_os_operational_cycles_os_sequence_order ON public.os_operational_cycles USING btree (ordem_servico_id, sequence_order);
CREATE INDEX idx_os_operational_cycles_os_state ON public.os_operational_cycles USING btree (ordem_servico_id, state);
CREATE INDEX idx_os_waypoint_comments_ordem_servico_id ON public.os_waypoint_comments USING btree (ordem_servico_id);
CREATE INDEX idx_os_waypoints_ordem_servico_id ON public.os_waypoints USING btree (ordem_servico_id);
CREATE INDEX idx_parceiros_contatos_parceiro_id ON public.parceiros_contatos USING btree (parceiro_id);
CREATE UNIQUE INDEX idx_parceiros_documento_unique ON public.parceiros_servico USING btree (lower(TRIM(BOTH FROM documento))) WHERE ((documento IS NOT NULL) AND (TRIM(BOTH FROM documento) <> ''::text));
CREATE INDEX idx_parceiros_filiais_parceiro_id ON public.parceiros_filiais USING btree (parceiro_id);
CREATE INDEX idx_parceiros_search ON public.parceiros_servico USING gin (to_tsvector('portuguese'::regconfig, search_index));
CREATE INDEX idx_parceiros_servico_status ON public.parceiros_servico USING btree (status);
CREATE INDEX idx_passageiros_celular_trgm ON public.passageiros USING gin (celular gin_trgm_ops);
CREATE INDEX idx_passageiros_cpf_trgm ON public.passageiros USING gin (cpf gin_trgm_ops);
CREATE INDEX idx_passageiros_email_trgm ON public.passageiros USING gin (email gin_trgm_ops);
CREATE INDEX idx_passageiros_nome_completo ON public.passageiros USING btree (nome_completo);
CREATE INDEX idx_passageiros_nome_completo_trgm ON public.passageiros USING gin (nome_completo gin_trgm_ops);
CREATE INDEX idx_pending_whatsapp_next_retry ON public.pending_whatsapp_messages USING btree (next_retry_at) WHERE (status = 'pending'::text);
CREATE INDEX idx_pending_whatsapp_os_id ON public.pending_whatsapp_messages USING btree (os_id);
CREATE INDEX idx_pending_whatsapp_status ON public.pending_whatsapp_messages USING btree (status);
CREATE INDEX idx_system_announcements_active ON public.system_announcements USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_system_announcements_expires ON public.system_announcements USING btree (expires_at) WHERE (expires_at IS NOT NULL);
CREATE INDEX idx_system_pendencias_itin ON public.system_pendencias USING btree (source_id, itinerary_index) WHERE (itinerary_index > 0);
CREATE INDEX idx_system_pendencias_motivo ON public.system_pendencias USING btree (motivo);
CREATE INDEX idx_system_pendencias_source ON public.system_pendencias USING btree (source_type, source_id);
CREATE UNIQUE INDEX idx_system_pendencias_unique ON public.system_pendencias USING btree (source_type, source_id, motivo, itinerary_index);
CREATE INDEX idx_system_pendencias_user ON public.system_pendencias USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX idx_user_presence_last_seen ON public.user_presence USING btree (last_seen_at DESC);
CREATE INDEX idx_user_presence_status ON public.user_presence USING btree (status);
CREATE INDEX idx_user_roles_specific_permissions ON public.user_roles USING gin (specific_permissions);
CREATE INDEX idx_vehicle_km_history_created_at ON public.vehicle_km_history USING btree (created_at DESC);
CREATE INDEX idx_vehicle_km_history_os_id ON public.vehicle_km_history USING btree (os_id);
CREATE INDEX idx_vehicle_km_history_veiculo_id ON public.vehicle_km_history USING btree (veiculo_id);
CREATE INDEX idx_vehicle_km_odometer_veiculo_id ON public.vehicle_km_odometer USING btree (veiculo_id);
CREATE INDEX idx_veiculos_marca_modelo ON public.veiculos USING btree (marca, modelo);
CREATE INDEX idx_veiculos_marca_trgm ON public.veiculos USING gin (marca gin_trgm_ops);
CREATE INDEX idx_veiculos_modelo_trgm ON public.veiculos USING gin (modelo gin_trgm_ops);
CREATE INDEX idx_veiculos_placa_trgm ON public.veiculos USING gin (placa gin_trgm_ops);
CREATE INDEX idx_veiculos_renavam_trgm ON public.veiculos USING gin (renavam gin_trgm_ops);
CREATE INDEX idx_veiculos_status ON public.veiculos USING btree (status);
CREATE INDEX idx_webhook_flow_events_context_id ON public.webhook_flow_events USING btree (context_id);
CREATE INDEX idx_webhook_flow_events_created_at ON public.webhook_flow_events USING btree (created_at);
CREATE INDEX idx_webhook_flow_events_os_id ON public.webhook_flow_events USING btree (os_id);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs USING btree (created_at DESC);
CREATE INDEX idx_webhook_logs_source ON public.webhook_logs USING btree (source);
CREATE INDEX idx_webhook_metrics_created_at ON public.webhook_metrics USING btree (created_at);
CREATE INDEX idx_webhook_metrics_event_type ON public.webhook_metrics USING btree (event_type);
CREATE INDEX idx_webhook_metrics_success ON public.webhook_metrics USING btree (success);
CREATE INDEX idx_webhook_rate_limits_phone ON public.webhook_rate_limits USING btree (phone);
CREATE INDEX idx_webhook_rate_limits_window_start ON public.webhook_rate_limits USING btree (window_start);
CREATE INDEX idx_wmt_message_id ON public.whatsapp_message_tracking USING btree (message_id);
CREATE INDEX idx_wmt_os_id ON public.whatsapp_message_tracking USING btree (os_id);
CREATE INDEX idx_wmt_status ON public.whatsapp_message_tracking USING btree (status);
CREATE INDEX os_waypoint_comments_ordem_servico_id_idx ON public.os_waypoint_comments USING btree (ordem_servico_id);
CREATE UNIQUE INDEX parceiros_contatos_celular_unique_normalized ON public.parceiros_contatos USING btree (regexp_replace(COALESCE(celular, ''::text), '\\D'::text, ''::text, 'g'::text)) WHERE (regexp_replace(COALESCE(celular, ''::text), '\\D'::text, ''::text, 'g'::text) <> ''::text);
CREATE UNIQUE INDEX parceiros_contatos_email_unique_normalized ON public.parceiros_contatos USING btree (lower(btrim(email))) WHERE (btrim(email) <> ''::text);
CREATE UNIQUE INDEX passageiros_celular_unique_normalized ON public.passageiros USING btree (regexp_replace(COALESCE(celular, ''::text), '\\D'::text, ''::text, 'g'::text)) WHERE (regexp_replace(COALESCE(celular, ''::text), '\\D'::text, ''::text, 'g'::text) <> ''::text);
CREATE UNIQUE INDEX passageiros_cpf_unique_normalized ON public.passageiros USING btree (regexp_replace(COALESCE(cpf, ''::text), '\\D'::text, ''::text, 'g'::text)) WHERE (regexp_replace(COALESCE(cpf, ''::text), '\\D'::text, ''::text, 'g'::text) <> ''::text);
CREATE UNIQUE INDEX passageiros_email_unique_normalized ON public.passageiros USING btree (lower(btrim(email))) WHERE (btrim(email) <> ''::text);

-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.alterar_status_docagem_instancia(p_instancia_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_instancia public.docagem_instancias%ROWTYPE;
BEGIN
  SELECT * INTO v_instancia
  FROM public.docagem_instancias
  WHERE id = p_instancia_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Instância de docagem não encontrada.';
  END IF;

  IF p_status NOT IN ('pendente', 'excluida') THEN
    RAISE EXCEPTION 'Status inválido para alteração manual.';
  END IF;

  IF v_instancia.status = 'finalizada' THEN
    RAISE EXCEPTION 'Não é possível alterar uma instância já finalizada.';
  END IF;

  UPDATE public.docagem_instancias
  SET status = p_status
  WHERE id = p_instancia_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.archive_os_atomic(p_os_id uuid, p_os_label text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_actor_id uuid;
  v_actor_name text;
BEGIN
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  v_actor_name := COALESCE(
    (SELECT nome FROM public.user_roles WHERE id = v_actor_id),
    'Sistema'
  );

  UPDATE public.ordens_servico SET arquivado = true WHERE id = p_os_id;

  INSERT INTO public.os_logs (os_id, type, description, actor_name, actor_id, metadata)
  VALUES (
    p_os_id,
    'archive',
    'OS arquivada' || CASE WHEN p_os_label IS NOT NULL AND p_os_label <> '' THEN ' — ' || p_os_label ELSE '' END,
    v_actor_name,
    v_actor_id,
    jsonb_build_object('action', 'archive')
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calc_hora_extra_billed_minutes(p_hora_extra text)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  v_total_minutes integer;
  v_blocks integer;
  v_remainder integer;
  v_billed_blocks integer;
  v_billed_minutes integer;
BEGIN
  IF p_hora_extra IS NULL OR trim(p_hora_extra) = '' OR trim(p_hora_extra) = '00:00' THEN
    RETURN 0;
  END IF;
  v_total_minutes := (
    EXTRACT(HOUR FROM p_hora_extra::interval) * 60 +
    EXTRACT(MINUTE FROM p_hora_extra::interval)
  )::integer;
  IF v_total_minutes <= 0 THEN
    RETURN 0;
  END IF;
  v_blocks     := v_total_minutes / 30;
  v_remainder  := v_total_minutes % 30;
  IF v_remainder > 15 THEN
    v_billed_blocks := v_blocks + 1;
  ELSE
    v_billed_blocks := v_blocks;
  END IF;
  v_billed_minutes := GREATEST(v_billed_blocks * 30, 60);
  RETURN v_billed_minutes;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_active_os_for_driver_vehicle(p_driver_id uuid, p_vehicle_id uuid, p_exclude_os_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM ordens_servico o
    WHERE o.arquivado = false
      AND o.driver_id = p_driver_id
      AND o.veiculo_id = p_vehicle_id
      AND o.status_operacional NOT IN ('Finalizado', 'Cancelado')
      AND (p_exclude_os_id IS NULL OR o.id != p_exclude_os_id)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_and_claim_flow_event(p_context_id text, p_flow_type text, p_os_id uuid, p_cycle_index integer, p_km_value numeric DEFAULT NULL::numeric, p_payload jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_existing_id UUID;
BEGIN
  SELECT id INTO v_existing_id FROM public.webhook_flow_events
  WHERE context_id = p_context_id AND flow_type = p_flow_type FOR UPDATE SKIP LOCKED;
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'alreadyProcessed', true, 'eventId', v_existing_id);
  END IF;
  INSERT INTO public.webhook_flow_events (context_id, flow_type, os_id, cycle_index, km_value, payload)
  VALUES (p_context_id, p_flow_type, p_os_id, p_cycle_index, p_km_value, p_payload)
  ON CONFLICT (context_id, flow_type) DO NOTHING
  RETURNING id INTO v_existing_id;
  IF v_existing_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'alreadyProcessed', true, 'eventId', NULL);
  END IF;
  RETURN jsonb_build_object('success', true, 'alreadyProcessed', false, 'eventId', v_existing_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_phone text, p_event_type text, p_max_per_minute integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  v_window_start := date_trunc('minute', NOW());
  INSERT INTO public.webhook_rate_limits (phone, event_type, count, window_start)
  VALUES (p_phone, p_event_type, 1, v_window_start)
  ON CONFLICT (phone, event_type, window_start) DO UPDATE SET count = webhook_rate_limits.count + 1
  RETURNING count INTO v_count;
  IF v_count > p_max_per_minute THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_count, 'limit', p_max_per_minute, 'resetAt', v_window_start + INTERVAL '1 minute');
  END IF;
  RETURN jsonb_build_object('allowed', true, 'count', v_count, 'limit', p_max_per_minute, 'resetAt', v_window_start + INTERVAL '1 minute');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_logs_batch()
 RETURNS TABLE(frontend_deleted bigint, webhook_deleted bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_frontend_deleted bigint := 0;
  v_webhook_deleted  bigint := 0;
BEGIN
  WITH deleted AS (
    DELETE FROM public.frontend_error_logs
    WHERE id IN (
      SELECT id FROM public.frontend_error_logs
      WHERE created_at < now() - interval '30 days'
      LIMIT 5000
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_frontend_deleted FROM deleted;

  WITH deleted AS (
    DELETE FROM public.webhook_logs
    WHERE id IN (
      SELECT id FROM public.webhook_logs
      WHERE created_at < now() - interval '7 days'
      LIMIT 5000
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_webhook_deleted FROM deleted;

  RETURN QUERY SELECT v_frontend_deleted, v_webhook_deleted;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ BEGIN DELETE FROM public.webhook_rate_limits WHERE window_start < NOW() - INTERVAL '1 hour'; END; $function$
;

CREATE OR REPLACE FUNCTION public.criar_docagem(p_cliente_id uuid, p_centro_custo_id uuid, p_solicitante_id uuid, p_motorista_id uuid, p_veiculo_id uuid, p_endereco text, p_data_inicio date, p_data_fim date, p_horario_inicio time without time zone, p_horario_fim time without time zone, p_dias_semana integer[], p_valor_diario numeric, p_custo_diario numeric, p_observacao text, p_observacao_financeira text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_docagem_id UUID;
  v_current_date DATE;
  v_dow INTEGER;
BEGIN
  IF p_data_inicio > p_data_fim THEN
    RAISE EXCEPTION 'Data de início não pode ser maior que data de fim.';
  END IF;

  IF p_valor_diario IS NULL OR p_valor_diario < 0 THEN
    RAISE EXCEPTION 'Valor diário inválido.';
  END IF;

  IF array_length(p_dias_semana, 1) IS NULL THEN
    RAISE EXCEPTION 'Pelo menos um dia da semana deve ser selecionado.';
  END IF;

  INSERT INTO public.docagens (
    protocolo,
    cliente_id,
    centro_custo_id,
    solicitante_id,
    motorista_id,
    veiculo_id,
    endereco,
    data_inicio,
    data_fim,
    horario_inicio,
    horario_fim,
    dias_semana,
    valor_diario,
    custo_diario,
    observacao,
    observacao_financeira,
    created_by
  ) VALUES (
    '',
    p_cliente_id,
    p_centro_custo_id,
    p_solicitante_id,
    p_motorista_id,
    p_veiculo_id,
    p_endereco,
    p_data_inicio,
    p_data_fim,
    p_horario_inicio,
    p_horario_fim,
    p_dias_semana,
    p_valor_diario,
    p_custo_diario,
    p_observacao,
    p_observacao_financeira,
    auth.uid()
  )
  RETURNING id INTO v_docagem_id;

  v_current_date := p_data_inicio;
  WHILE v_current_date <= p_data_fim LOOP
    v_dow := EXTRACT(DOW FROM v_current_date)::INTEGER;
    IF v_dow = ANY(p_dias_semana) THEN
      INSERT INTO public.docagem_instancias (
        docagem_id,
        data,
        horario_inicio,
        horario_fim,
        endereco,
        motorista_id,
        veiculo_id,
        valor,
        custo,
        observacao_financeira
      )
      VALUES (
        v_docagem_id,
        v_current_date,
        p_horario_inicio,
        p_horario_fim,
        p_endereco,
        p_motorista_id,
        p_veiculo_id,
        p_valor_diario,
        p_custo_diario,
        p_observacao_financeira
      )
      ON CONFLICT (docagem_id, data) DO NOTHING;
    END IF;
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  RETURN v_docagem_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_docagem(p_cliente_id uuid, p_centro_custo_id uuid, p_solicitante_id uuid, p_motorista_id uuid, p_veiculo_id uuid, p_endereco text, p_data_inicio date, p_data_fim date, p_horario_inicio time without time zone, p_horario_fim time without time zone, p_dias_semana integer[], p_valor_diario numeric, p_custo_diario numeric, p_observacao text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_docagem_id UUID;
  v_current_date DATE;
  v_dow INTEGER;
BEGIN
  IF p_data_inicio > p_data_fim THEN
    RAISE EXCEPTION 'Data de início não pode ser maior que data de fim.';
  END IF;

  IF p_valor_diario IS NULL OR p_valor_diario < 0 THEN
    RAISE EXCEPTION 'Valor diário inválido.';
  END IF;

  IF array_length(p_dias_semana, 1) IS NULL THEN
    RAISE EXCEPTION 'Pelo menos um dia da semana deve ser selecionado.';
  END IF;

  INSERT INTO public.docagens (
    protocolo, cliente_id, centro_custo_id, solicitante_id, motorista_id, veiculo_id,
    endereco, data_inicio, data_fim, horario_inicio, horario_fim, dias_semana,
    valor_diario, custo_diario, observacao, created_by
  ) VALUES (
    '', p_cliente_id, p_centro_custo_id, p_solicitante_id, p_motorista_id, p_veiculo_id,
    p_endereco, p_data_inicio, p_data_fim, p_horario_inicio, p_horario_fim, p_dias_semana,
    p_valor_diario, p_custo_diario, p_observacao, auth.uid()
  )
  RETURNING id INTO v_docagem_id;

  v_current_date := p_data_inicio;
  WHILE v_current_date <= p_data_fim LOOP
    v_dow := EXTRACT(DOW FROM v_current_date)::INTEGER;
    IF v_dow = ANY(p_dias_semana) THEN
      INSERT INTO public.docagem_instancias (
        docagem_id, data, horario_inicio, horario_fim, endereco,
        motorista_id, veiculo_id, valor, custo
      )
      VALUES (
        v_docagem_id, v_current_date, p_horario_inicio, p_horario_fim, p_endereco,
        p_motorista_id, p_veiculo_id, p_valor_diario, p_custo_diario
      )
      ON CONFLICT (docagem_id, data) DO NOTHING;
    END IF;
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  RETURN v_docagem_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cycle_ordinal_to_pt(ordinal integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE ordinal
    WHEN 1 THEN 'Primeiro'
    WHEN 2 THEN 'Segundo'
    WHEN 3 THEN 'Terceiro'
    WHEN 4 THEN 'Quarto'
    WHEN 5 THEN 'Quinto'
    WHEN 6 THEN 'Sexto'
    WHEN 7 THEN 'Sétimo'
    WHEN 8 THEN 'Oitavo'
    WHEN 9 THEN 'Nono'
    WHEN 10 THEN 'Décimo'
    ELSE ordinal::text
  END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_old_logs()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.frontend_error_logs
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Optional: log cleanup action to the table itself (last entry)
  IF deleted_count > 0 THEN
    INSERT INTO public.frontend_error_logs (
      user_id,
      error_level,
      component,
      function_name,
      error_message,
      error_details,
      url,
      user_agent
    ) VALUES (
      NULL,
      'info',
      'LogCleanup',
      'delete_old_logs',
      format('Limpeza automática: %s logs apagados (mais de 90 dias)', deleted_count),
      jsonb_build_object('deleted_count', deleted_count, 'retention_days', 90, 'ran_at', NOW()),
      'cron://pg_cron',
      'pg_cron/1.0'
    );
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.derive_os_operational_status_from_cycles(p_os_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_has_in_progress BOOLEAN;
  v_has_waiting     BOOLEAN;
  v_active_total    INTEGER;
  v_completed_total INTEGER;
BEGIN
  SELECT
    COALESCE(BOOL_OR(state IN ('awaiting_finish', 'awaiting_km_finish')), false),
    COALESCE(BOOL_OR(state IN ('awaiting_accept', 'awaiting_start', 'awaiting_km_start')), false),
    COUNT(*) FILTER (WHERE state <> 'cancelled'),
    COUNT(*) FILTER (WHERE state = 'completed')
  INTO v_has_in_progress, v_has_waiting, v_active_total, v_completed_total
  FROM public.os_operational_cycles
  WHERE ordem_servico_id = p_os_id;

  IF v_has_in_progress THEN RETURN 'Em Rota';   END IF;
  IF v_has_waiting     THEN RETURN 'Aguardando'; END IF;
  IF v_active_total > 0 AND v_active_total = v_completed_total THEN RETURN 'Finalizado'; END IF;
  IF v_active_total = 0 THEN RETURN 'Cancelado'; END IF;

  -- Se há ciclos concluídos mas nem todos os ativos estão concluídos,
  -- os ciclos "pending" restantes estão aguardando ativação.
  IF v_completed_total > 0 THEN RETURN 'Aguardando'; END IF;

  RETURN 'Pendente';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fill_app_notification_author()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.created_by IS NOT NULL AND (NEW.created_by_name IS NULL OR NEW.created_by_name = '') THEN
    SELECT COALESCE(raw_user_meta_data->>'nome', email)
    INTO NEW.created_by_name
    FROM auth.users
    WHERE id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.finalizar_docagem_dia(p_instancia_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_instancia public.docagem_instancias%ROWTYPE;
  v_lancamento_id UUID;
BEGIN
  SELECT * INTO v_instancia
  FROM public.docagem_instancias
  WHERE id = p_instancia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Instância de docagem não encontrada.';
  END IF;

  IF v_instancia.status = 'excluida' THEN
    RAISE EXCEPTION 'Não é possível finalizar uma instância excluída.';
  END IF;

  IF v_instancia.status = 'finalizada' THEN
    RAISE EXCEPTION 'Esta instância já foi finalizada.';
  END IF;

  UPDATE public.docagem_instancias
  SET status = 'finalizada',
      finalizada_em = now(),
      finalizada_por = auth.uid()
  WHERE id = p_instancia_id;

  INSERT INTO public.docagem_lancamentos (
    docagem_instancia_id,
    data,
    cliente_id,
    centro_custo_id,
    motorista_id,
    valor,
    custo,
    status
  )
  VALUES (
    v_instancia.id,
    v_instancia.data,
    (SELECT cliente_id FROM public.docagens WHERE id = v_instancia.docagem_id),
    (SELECT centro_custo_id FROM public.docagens WHERE id = v_instancia.docagem_id),
    v_instancia.motorista_id,
    v_instancia.valor,
    v_instancia.custo,
    'realizado'
  )
  RETURNING id INTO v_lancamento_id;

  RETURN v_lancamento_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.finish_cycle_manual(p_os_id uuid, p_cycle_index integer, p_actor_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_cycles         JSONB;
  v_updated_cycles JSONB := '[]'::JSONB;
  v_cycle          JSONB;
  v_km_initial     NUMERIC;
  v_target_found   BOOLEAN := false;
  v_new_status     TEXT;
  v_now            TIMESTAMPTZ := NOW();
BEGIN
  WITH locked_cycles AS (
    SELECT *
    FROM public.os_operational_cycles
    WHERE ordem_servico_id = p_os_id
    ORDER BY sequence_order
    FOR UPDATE
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'itineraryIndex', itinerary_index,
        'sequenceOrder',  sequence_order,
        'kind',           kind,
        'ordinal',        ordinal,
        'title',          title,
        'state',          state,
        'messageSentAt',  message_sent_at,
        'acceptedAt',     accepted_at,
        'startedAt',      started_at,
        'finishedAt',     finished_at,
        'kmInitial',      km_initial,
        'kmFinal',        km_final
      )
      ORDER BY sequence_order
    ),
    '[]'::JSONB
  )
  INTO v_cycles
  FROM locked_cycles;

  IF v_cycles IS NULL OR jsonb_array_length(v_cycles) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'NO_OPERATIONAL_CYCLES',
      'message', 'OS não possui ciclos operacionais cadastrados'
    );
  END IF;

  FOR v_cycle IN SELECT * FROM jsonb_array_elements(v_cycles)
  LOOP
    IF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index THEN
      IF (v_cycle->>'state')::TEXT IN ('completed', 'cancelled') THEN
        RETURN jsonb_build_object(
          'success',          false,
          'error',            'ALREADY_FINISHED',
          'already_finished', true,
          'message',          'Este ciclo já está finalizado'
        );
      END IF;

      v_km_initial := (v_cycle->>'kmInitial')::NUMERIC;
      v_cycle := jsonb_set(v_cycle, '{state}',      to_jsonb('completed'::TEXT), true);
      v_cycle := jsonb_set(v_cycle, '{finishedAt}', to_jsonb(v_now::TEXT),        true);

      IF (v_cycle->>'acceptedAt') IS NULL THEN
        v_cycle := jsonb_set(v_cycle, '{acceptedAt}', to_jsonb(v_now::TEXT), true);
      END IF;
      IF (v_cycle->>'startedAt') IS NULL THEN
        v_cycle := jsonb_set(v_cycle, '{startedAt}', to_jsonb(v_now::TEXT), true);
      END IF;

      v_target_found := true;
    END IF;
    v_updated_cycles := v_updated_cycles || jsonb_build_array(v_cycle);
  END LOOP;

  IF NOT v_target_found THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error',      'CYCLE_NOT_FOUND',
      'message',    'Ciclo operacional não encontrado',
      'cycleIndex', p_cycle_index
    );
  END IF;

  PERFORM public.replace_os_operational_cycles(p_os_id, v_updated_cycles);

  v_new_status := public.derive_os_operational_status_from_cycles(p_os_id);

  UPDATE public.ordens_servico
  SET
    status_operacional = v_new_status,
    route_finished_at  = v_now,
    route_started_at   = COALESCE(route_started_at, v_now),
    updated_at         = v_now
  WHERE id = p_os_id;

  INSERT INTO public.os_logs (os_id, type, actor_name, description, metadata)
  VALUES (
    p_os_id,
    'status_change',
    p_actor_name,
    'Ciclo finalizado manualmente pelo operador' ||
      CASE WHEN v_km_initial IS NOT NULL
        THEN ' (km inicial registrado: ' || v_km_initial::TEXT || ', km final ignorado)'
        ELSE ' (sem KM registrado)'
      END,
    jsonb_build_object(
      'cycleIndex', p_cycle_index,
      'kmInitial',  v_km_initial,
      'hasKm',      v_km_initial IS NOT NULL
    )
  );

  RETURN jsonb_build_object(
    'success',           true,
    'osId',              p_os_id,
    'cycleIndex',        p_cycle_index,
    'statusOperacional', v_new_status,
    'kmInitial',         v_km_initial,
    'updatedCycles',     v_updated_cycles
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_docagem_protocolo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  seq_val INTEGER;
  year_month TEXT;
BEGIN
  IF NEW.protocolo IS NULL OR NEW.protocolo = '' THEN
    seq_val := nextval('protocolo_seq');
    year_month := to_char(CURRENT_DATE, 'YYYYMM');
    NEW.protocolo := year_month || lpad(seq_val::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_protocolo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  seq_val INTEGER;
  year_month TEXT;
BEGIN
  seq_val := nextval('protocolo_seq');
  year_month := to_char(CURRENT_DATE, 'YYYYMM');
  NEW.protocolo := year_month || lpad(seq_val::TEXT, 4, '0');
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_imposto_percentual_for_date(p_date date)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
declare
  v_value text;
  v_percent numeric := 12;
begin
  if to_regclass('public.financial_config_history') is not null then
    select value
    into v_value
    from public.financial_config_history
    where config_key = 'imposto_percentual'
      and effective_from <= p_date
    order by effective_from desc
    limit 1;
  end if;

  if v_value is null and to_regclass('public.app_settings') is not null then
    select value
    into v_value
    from public.app_settings
    where key = 'imposto_percentual'
    limit 1;
  end if;

  if v_value is not null then
    v_percent := coalesce(nullif(trim(v_value), '')::numeric, 12);
  end if;

  if v_percent < 0 or v_percent > 100 then
    v_percent := 12;
  end if;

  return v_percent;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_os_calendar_events(p_from date, p_to date)
 RETURNS TABLE(id uuid, protocolo text, data date, hora text, status_operacional text, cliente_id uuid, motorista text, driver_id uuid, veiculo_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.protocolo,
    o.data,
    o.hora,
    o.status_operacional,
    o.cliente_id,
    o.motorista,
    o.driver_id,
    o.veiculo_id
  FROM ordens_servico o
  WHERE o.arquivado = false
    AND o.data BETWEEN p_from AND p_to
  ORDER BY o.data, o.hora;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_os_cycles_for_reminders(p_active_states text[])
 RETURNS TABLE(cycle_id uuid, os_id uuid, protocolo text, os_number text, motorista text, driver_id uuid, driver_phone text, cycle_index integer, cycle_title text, cycle_state text, message_sent_at timestamp with time zone, started_at timestamp with time zone, waypoint_data date, waypoint_hora text, os_data date, os_hora text, cliente_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH ranked_waypoints AS (
    SELECT
      w.ordem_servico_id,
      w.itinerary_index,
      w.data AS wp_data,
      w.hora::text AS wp_hora,
      ROW_NUMBER() OVER (
        PARTITION BY w.ordem_servico_id, w.itinerary_index
        ORDER BY w.position
      ) AS rn
    FROM public.os_waypoints w
    WHERE w.data IS NOT NULL AND w.hora IS NOT NULL
  )
  SELECT
    c.id AS cycle_id,
    o.id AS os_id,
    o.protocolo,
    o.os_number,
    o.motorista,
    o.driver_id,
    d.phone AS driver_phone,
    c.itinerary_index AS cycle_index,
    c.title AS cycle_title,
    c.state AS cycle_state,
    c.message_sent_at,
    c.started_at,
    rw.wp_data AS waypoint_data,
    rw.wp_hora AS waypoint_hora,
    o.data AS os_data,
    o.hora AS os_hora,
    o.cliente_id
  FROM public.os_operational_cycles c
  JOIN public.ordens_servico o ON o.id = c.ordem_servico_id
  LEFT JOIN public.drivers d ON d.id = o.driver_id
  LEFT JOIN ranked_waypoints rw
    ON rw.ordem_servico_id = c.ordem_servico_id
    AND rw.itinerary_index = c.itinerary_index
    AND rw.rn = 1
  WHERE o.arquivado = false
    AND o.status_operacional NOT IN ('Cancelado', 'Finalizado')
    AND c.state = ANY (p_active_states)
    AND c.message_sent_at IS NOT NULL
    AND c.started_at IS NULL
  ORDER BY o.protocolo, c.sequence_order;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_os_finance_stats(p_month text)
 RETURNS TABLE(total_os bigint, total_bruto numeric, total_custo numeric, total_imposto numeric, total_lucro numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(valor_bruto), 0)::numeric,
    COALESCE(SUM(custo), 0)::numeric,
    COALESCE(SUM(imposto), 0)::numeric,
    COALESCE(SUM(lucro), 0)::numeric
  FROM ordens_servico
  WHERE arquivado = false
    AND data LIKE (p_month || '%');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_os_status_counts()
 RETURNS TABLE(status text, count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT o.status_operacional, COUNT(*)::bigint
  FROM ordens_servico o
  WHERE o.arquivado = false
  GROUP BY o.status_operacional;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_extract_query_trgm$function$
;

CREATE OR REPLACE FUNCTION public.gin_extract_value_trgm(text, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_extract_value_trgm$function$
;

CREATE OR REPLACE FUNCTION public.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_trgm_consistent$function$
;

CREATE OR REPLACE FUNCTION public.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal)
 RETURNS "char"
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_trgm_triconsistent$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_compress(internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_compress$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_consistent(internal, text, smallint, oid, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_consistent$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_decompress(internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_decompress$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_distance(internal, text, smallint, oid, internal)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_distance$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_in(cstring)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_in$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_options(internal)
 RETURNS void
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE
AS '$libdir/pg_trgm', $function$gtrgm_options$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_out(gtrgm)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_out$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_penalty(internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_penalty$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_picksplit(internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_picksplit$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_same(gtrgm, gtrgm, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_same$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_union(internal, internal)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_union$function$
;

CREATE OR REPLACE FUNCTION public.handle_docagem_cancelled_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id UUID;
  v_cliente_nome TEXT;
BEGIN
  IF NEW.status = 'cancelada' AND (OLD.status IS NULL OR OLD.status != 'cancelada') THEN
    v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
    SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = NEW.cliente_id;

    PERFORM public.insert_docagem_notification(
      'warning', 'Docagem cancelada',
      format('Docagem %s de %s foi cancelada.', COALESCE(NEW.protocolo, ''), COALESCE(v_cliente_nome, 'Cliente')),
      NEW.cliente_id, v_actor_id,
      jsonb_build_object('docagem_id', NEW.id, 'protocolo', NEW.protocolo)
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_docagem_created_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id UUID;
  v_cliente_nome TEXT;
BEGIN
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = NEW.cliente_id;

  PERFORM public.insert_docagem_notification(
    'success', 'Nova docagem',
    format('Docagem %s criada para %s.', COALESCE(NEW.protocolo, ''), COALESCE(v_cliente_nome, 'Cliente')),
    NEW.cliente_id, v_actor_id,
    jsonb_build_object('docagem_id', NEW.id, 'protocolo', NEW.protocolo, 'cliente_id', NEW.cliente_id)
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_docagem_instance_status_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id UUID;
  v_docagem public.docagens%ROWTYPE;
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_acao TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  SELECT * INTO v_docagem FROM public.docagens WHERE id = NEW.docagem_id;

  CASE NEW.status
    WHEN 'finalizada' THEN
      v_title := 'Dia de docagem finalizado';
      v_acao := 'finalizado';
      v_type := 'success';
    WHEN 'pendente' THEN
      IF OLD.status = 'finalizada' THEN
        v_title := 'Dia de docagem resetado';
        v_acao := 'resetado';
        v_type := 'warning';
      ELSE
        v_title := 'Dia de docagem reativado';
        v_acao := 'reativado';
        v_type := 'success';
      END IF;
    WHEN 'excluida' THEN
      v_title := 'Dia de docagem excluído';
      v_acao := 'excluído';
      v_type := 'warning';
    ELSE
      RETURN NEW;
  END CASE;

  v_message := format('Docagem %s do dia %s foi %s.', COALESCE(v_docagem.protocolo, ''), NEW.data, v_acao);

  PERFORM public.insert_docagem_notification(
    v_type, v_title, v_message, v_docagem.cliente_id, v_actor_id,
    jsonb_build_object('docagem_id', v_docagem.id, 'instancia_id', NEW.id, 'protocolo', v_docagem.protocolo, 'data', NEW.data, 'status', NEW.status, 'status_anterior', OLD.status)
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_driver_update_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_changes text[] := '{}';
  v_message text;
BEGIN
  IF TG_OP != 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.name IS DISTINCT FROM OLD.name THEN
    v_changes := array_append(v_changes, 'nome');
  END IF;
  IF NEW.cpf IS DISTINCT FROM OLD.cpf THEN
    v_changes := array_append(v_changes, 'CPF');
  END IF;
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    v_changes := array_append(v_changes, 'celular');
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    v_changes := array_append(v_changes, 'e-mail');
  END IF;
  IF NEW.cnh IS DISTINCT FROM OLD.cnh THEN
    v_changes := array_append(v_changes, 'CNH');
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_changes := array_append(v_changes, 'status');
  END IF;
  IF NEW.vinculo_tipo IS DISTINCT FROM OLD.vinculo_tipo THEN
    v_changes := array_append(v_changes, 'vínculo');
  END IF;
  IF NEW.parceiro_id IS DISTINCT FROM OLD.parceiro_id THEN
    v_changes := array_append(v_changes, 'parceiro');
  END IF;
  IF NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id THEN
    v_changes := array_append(v_changes, 'veículo');
  END IF;
  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
    v_changes := array_append(v_changes, 'foto');
  END IF;
  IF NEW.arquivado IS DISTINCT FROM OLD.arquivado THEN
    v_changes := array_append(v_changes, 'arquivamento');
  END IF;

  IF array_length(v_changes, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_message := format('teve %s atualizada%s.',
    CASE
      WHEN array_length(v_changes, 1) = 1 THEN v_changes[1]
      ELSE array_to_string(v_changes[1:array_length(v_changes,1)-1], ', ') || ' e ' || v_changes[array_length(v_changes,1)]
    END,
    CASE WHEN array_length(v_changes, 1) > 1 THEN 's' ELSE '' END
  );

  INSERT INTO public.app_notifications (
    type, title, message, target_audience, empresa_id,
    created_by, created_by_name, created_by_avatar_url, metadata
  )
  VALUES (
    'info',
    'Motorista atualizado',
    v_message,
    'all',
    NULL,
    NULL,
    COALESCE(NEW.name, 'Motorista'),
    NEW.avatar_url,
    jsonb_build_object(
      'driver_id', NEW.id,
      'driver_name', NEW.name,
      'changed_fields', to_jsonb(v_changes)
    )
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_centro_custo_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE v_user_id uuid := auth.uid(); v_actor_name text; v_actor_avatar text; BEGIN IF v_user_id IS NOT NULL THEN SELECT nome, avatar_url INTO v_actor_name, v_actor_avatar FROM public.user_roles WHERE id = v_user_id; END IF; INSERT INTO public.app_notifications ( type, title, message, target_audience, created_by, created_by_name, created_by_avatar_url ) VALUES ( 'info', 'Novo Centro de Custo', 'criou um novo Centro de Custo.', 'interno', v_user_id, v_actor_name, v_actor_avatar ); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_cliente_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO public.app_notifications (type, title, message, target_audience)
    VALUES ('success', 'Nova Empresa Cadastrada', 'A empresa ' || NEW.nome || ' foi adicionada ao sistema.', 'interno');
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_os_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
    v_avatar_url text;
begin
    IF NEW.tipo = 'rascunho' THEN
        RETURN NEW;
    END IF;

    select avatar_url into v_avatar_url
    from public.user_roles
    where id = NEW.created_by;

    insert into public.app_notifications (
        type,
        title,
        message,
        target_audience,
        empresa_id,
        created_by,
        created_by_name,
        created_by_avatar_url
    )
    values (
        'success',
        'Novo atendimento',
        'OS cadastrada com sucesso.',
        'interno',
        NEW.cliente_id,
        NEW.created_by,
        NEW.created_by_name,
        v_avatar_url
    );

    return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.user_roles (id, nome, tipo_usuario, categoria)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 'interno', 'operador');
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_os_log_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_protocolo text;
  v_cliente_id uuid;
  v_motorista_nome text;
  v_avatar_url text;
  v_changed_sections text;
  v_updates text;
  v_action text;
  v_cycle_index integer;
  v_cycle_label text;
  v_cycle_kind text;
  v_cycle_ordinal integer;
  v_km_value text;
  v_minutes_late integer;
  v_title text;
  v_message text;
  v_notification_type text;
  v_category text := 'sistema';
  v_detail text;
  v_details text[] := '{}'::text[];
  v_change jsonb;
  v_driver_name text;
  v_repasse_os_count integer;
  v_periodo text;
  v_attach_os_id boolean := true;
BEGIN
  IF NEW.type NOT IN (
    'update',
    'status_change',
    'archive',
    'unarchive',
    'driver_accept',
    'driver_start',
    'driver_finish',
    'driver_notify',
    'driver_delivered',
    'driver_delay',
    'comment',
    'driver_edit_ack',
    'driver_start_reminder'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT protocolo, cliente_id, motorista
    INTO v_protocolo, v_cliente_id, v_motorista_nome
  FROM public.ordens_servico
  WHERE id = NEW.os_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.metadata ? 'cliente_id' THEN
    BEGIN
      v_cliente_id := nullif(NEW.metadata->>'cliente_id', '')::uuid;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  SELECT avatar_url
    INTO v_avatar_url
  FROM public.user_roles
  WHERE id = NEW.actor_id;

  IF v_avatar_url IS NULL AND NEW.actor_id IS NULL AND NEW.actor_name IS NOT NULL AND NEW.actor_name <> '' THEN
    SELECT d.avatar_url
      INTO v_avatar_url
    FROM public.drivers d
    WHERE lower(d.name) = lower(NEW.actor_name)
      AND d.avatar_url IS NOT NULL
      AND d.avatar_url <> ''
    LIMIT 1;

    IF v_avatar_url IS NULL AND length(NEW.actor_name) >= 3 THEN
      SELECT d.avatar_url
        INTO v_avatar_url
      FROM public.drivers d
      WHERE lower(d.name) LIKE lower(NEW.actor_name) || '%'
        AND d.avatar_url IS NOT NULL
        AND d.avatar_url <> ''
        AND (
          SELECT count(*) FROM public.drivers d2
          WHERE lower(d2.name) LIKE lower(NEW.actor_name) || '%'
        ) = 1
      LIMIT 1;
    END IF;
  END IF;

  IF NEW.metadata ? 'changed_sections' AND jsonb_typeof(NEW.metadata->'changed_sections') = 'array' THEN
    SELECT string_agg(section.value, ', ')
      INTO v_changed_sections
    FROM jsonb_array_elements_text(coalesce(NEW.metadata->'changed_sections', '[]'::jsonb)) AS section(value);
  END IF;

  IF NEW.metadata ? 'field_changes' AND jsonb_typeof(NEW.metadata->'field_changes') = 'array' THEN
    FOR v_change IN SELECT value FROM jsonb_array_elements(NEW.metadata->'field_changes') AS value
    LOOP
      IF v_change->>'action' = 'added' THEN
        v_detail := format('Adicionou %s%s',
          v_change->>'field',
          CASE WHEN v_change->>'to' IS NOT NULL AND v_change->>'to' <> '' THEN format(': %s', v_change->>'to') ELSE '' END
        );
      ELSIF v_change->>'action' = 'removed' THEN
        v_detail := format('Removeu %s%s',
          v_change->>'field',
          CASE WHEN v_change->>'from' IS NOT NULL AND v_change->>'from' <> '' THEN format(': %s', v_change->>'from') ELSE '' END
        );
      ELSE
        v_detail := format('%s: %s → %s',
          v_change->>'field',
          coalesce(nullif(v_change->>'from', ''), '—'),
          coalesce(nullif(v_change->>'to', ''), '—')
        );
      END IF;
      v_details := array_append(v_details, v_detail);
    END LOOP;
  END IF;

  IF NEW.metadata ? 'updates' AND jsonb_typeof(NEW.metadata->'updates') = 'object' THEN
    v_updates := nullif(
      concat_ws(
        ' | ',
        nullif(NEW.metadata->'updates'->>'operacional', ''),
        nullif(NEW.metadata->'updates'->>'financeiro', '')
      ),
      ''
    );
  END IF;

  IF NEW.metadata ? 'cycle_index' THEN
    BEGIN
      v_cycle_index := (NEW.metadata->>'cycle_index')::integer;
      v_cycle_label := format('no ciclo %s', v_cycle_index + 1);
    EXCEPTION
      WHEN OTHERS THEN
        v_cycle_label := NULL;
    END;
  END IF;

  -- Popula v_cycle_kind e v_cycle_ordinal a partir da tabela canonica
  -- (segue o mesmo padrao do SELECT protocolo/cliente_id/motorista acima)
  IF v_cycle_index IS NOT NULL THEN
    SELECT kind, ordinal
      INTO v_cycle_kind, v_cycle_ordinal
    FROM public.os_operational_cycles
    WHERE ordem_servico_id = NEW.os_id
      AND itinerary_index = v_cycle_index;
  END IF;

  IF NEW.metadata ? 'action' THEN
    v_action := NEW.metadata->>'action';
  END IF;

  IF NEW.metadata ? 'km_initial' THEN
    v_km_value := NEW.metadata->>'km_initial';
  ELSIF NEW.metadata ? 'km_final' THEN
    v_km_value := NEW.metadata->>'km_final';
  END IF;

  IF NEW.metadata ? 'minutes_late' THEN
    BEGIN
      v_minutes_late := (NEW.metadata->>'minutes_late')::integer;
    EXCEPTION
      WHEN OTHERS THEN
        v_minutes_late := NULL;
    END;
  END IF;

  CASE NEW.type
    WHEN 'update' THEN
      v_title := 'Atendimento atualizado';
      IF array_length(v_details, 1) > 0 THEN
        v_message := format(
          'A OS %s foi atualizada por %s. %s',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          array_to_string(v_details, ' | ')
        );
        IF length(v_message) > 330 THEN
          v_message := substring(v_message from 1 for 330) || '...';
        END IF;
      ELSIF v_changed_sections IS NOT NULL THEN
        v_message := format(
          'A OS %s recebeu uma atualização de %s. Itens alterados: %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          v_changed_sections
        );
      ELSE
        v_message := format(
          'A OS %s recebeu uma atualização de %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema')
        );
      END IF;
      v_notification_type := 'info';
    WHEN 'status_change' THEN
      IF v_action = 'repasse_lote_pago' OR coalesce(NEW.metadata->>'lote', 'false') = 'true' THEN
        SELECT name
          INTO v_driver_name
        FROM public.drivers
        WHERE id = nullif(NEW.metadata->>'driver_id', '')::uuid;

        v_repasse_os_count := coalesce(jsonb_array_length(coalesce(NEW.metadata->'os_ids', '[]'::jsonb)), 0);

        IF NEW.metadata ? 'data_inicio' AND NEW.metadata ? 'data_fim' THEN
          v_periodo := format(' no período %s a %s', NEW.metadata->>'data_inicio', NEW.metadata->>'data_fim');
        END IF;

        v_title := 'Repasse em lote registrado';
        v_message := format(
          'O repasse em lote do motorista %s foi marcado como pago%s%s.',
          coalesce(v_driver_name, nullif(NEW.metadata->>'driver_id', ''), 'Sistema'),
          CASE WHEN v_repasse_os_count > 0 THEN format(' (%s OS)', v_repasse_os_count) ELSE '' END,
          coalesce(v_periodo, '')
        );
        v_notification_type := 'success';
        v_attach_os_id := false;
      ELSIF v_action = 'finish_all' THEN
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'Todos os ciclos da OS %s foram finalizados por %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema')
        );
        v_notification_type := 'warning';
      ELSIF v_action = 'finish_cycle' THEN
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'O ciclo da OS %s foi finalizado manualmente por %s%s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          CASE WHEN v_cycle_label IS NOT NULL THEN format(' (%s)', v_cycle_label) ELSE '' END
        );
        v_notification_type := 'warning';
      ELSIF v_action = 'revert_to_pending' THEN
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'O ciclo da OS %s foi revertido para pendente por %s%s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          CASE WHEN v_cycle_label IS NOT NULL THEN format(' (%s)', v_cycle_label) ELSE '' END
        );
        v_notification_type := 'warning';
      ELSIF v_action = 'revert_to_accept' THEN
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'O ciclo da OS %s voltou para aceite por %s%s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          CASE WHEN v_cycle_label IS NOT NULL THEN format(' (%s)', v_cycle_label) ELSE '' END
        );
        v_notification_type := 'warning';
      ELSIF v_updates IS NOT NULL THEN
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'A OS %s foi atualizada por %s. Status: %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          v_updates
        );
        v_notification_type := 'warning';
      ELSE
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'A OS %s teve o status atualizado por %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema')
        );
        v_notification_type := 'warning';
      END IF;
    WHEN 'archive' THEN
      v_title := 'Atendimento arquivado';
      v_message := format(
        'A OS %s foi arquivada por %s.',
        coalesce(v_protocolo, NEW.os_id::text),
        coalesce(NEW.actor_name, 'Sistema')
      );
      v_notification_type := 'warning';
    WHEN 'unarchive' THEN
      v_title := 'Atendimento reaberto';
      v_message := format(
        'A OS %s foi reaberta por %s.',
        coalesce(v_protocolo, NEW.os_id::text),
        coalesce(NEW.actor_name, 'Sistema')
      );
      v_notification_type := 'success';
    WHEN 'driver_accept' THEN
      v_title := 'Motorista visualizou os detalhes do atendimento';
      v_message := 'visualizou os detalhes do atendimento';
      v_notification_type := 'info';
      v_category := 'motorista';
    WHEN 'driver_start' THEN
      v_title := 'Rota iniciada';
      v_message := format(
        'A OS %s iniciou a rota%s%s.',
        coalesce(v_protocolo, NEW.os_id::text),
        CASE WHEN v_cycle_label IS NOT NULL THEN format(' (%s)', v_cycle_label) ELSE '' END,
        CASE WHEN v_km_value IS NOT NULL THEN format(' com KM inicial %s', v_km_value) ELSE '' END
      );
      v_notification_type := 'info';
      v_category := 'motorista';
    WHEN 'driver_finish' THEN
      v_title := 'Rota finalizada';
      v_message := format(
        'A OS %s finalizou a rota%s%s.',
        coalesce(v_protocolo, NEW.os_id::text),
        CASE WHEN v_cycle_label IS NOT NULL THEN format(' (%s)', v_cycle_label) ELSE '' END,
        CASE WHEN v_km_value IS NOT NULL THEN format(' com KM final %s', v_km_value) ELSE '' END
      );
      v_notification_type := 'success';
      v_category := 'motorista';
    WHEN 'driver_notify' THEN
      v_title := format('Mensagem enviada ao motorista %s', coalesce(v_motorista_nome, ''));
      v_message := format(
        '%s enviou uma mensagem ao motorista %s.',
        coalesce(NEW.actor_name, 'Sistema'),
        coalesce(v_motorista_nome, 'Motorista')
      );
      v_notification_type := 'success';
      v_category := 'motorista';
    WHEN 'driver_delivered' THEN
      v_title := 'Mensagem entregue ao motorista';
      v_message := format(
        'Motorista %s visualizou a mensagem.',
        coalesce(NEW.actor_name, 'Motorista')
      );
      v_notification_type := 'success';
      v_category := 'motorista';
    WHEN 'driver_delay' THEN
      v_title := 'Motorista em atraso';
      v_message := format(
        'Atendimento com %s min de atraso.',
        coalesce(v_minutes_late::text, '?')
      );
      v_notification_type := 'warning';
      v_category := 'motorista';
    WHEN 'comment' THEN
      v_title := 'Novo comentário no atendimento';
      v_message := format('A OS %s recebeu um novo comentário.', coalesce(v_protocolo, NEW.os_id::text));
      v_notification_type := 'info';
    WHEN 'driver_edit_ack' THEN
      v_title := 'Motorista confirmou alteração';
      v_message := 'confirmou estar ciente da alteração do atendimento';
      v_notification_type := 'success';
      v_category := 'motorista';
    WHEN 'driver_start_reminder' THEN
      v_title := 'Lembrete de Iniciar Rota enviado';
      v_message := 'Lembrete de iniciar rota enviado';
      v_notification_type := 'info';
      v_category := 'motorista';
    ELSE
      RETURN NEW;
  END CASE;

  IF v_attach_os_id THEN
    v_message := v_message || format(' [OS_ID:%s]', NEW.os_id);
  END IF;

  INSERT INTO public.app_notifications (
    type,
    title,
    message,
    target_audience,
    empresa_id,
    created_by,
    created_by_name,
    created_by_avatar_url,
    category,
    metadata
  )
  VALUES (
    v_notification_type,
    v_title,
    v_message,
    'interno',
    v_cliente_id,
    NEW.actor_id,
    NEW.actor_name,
    v_avatar_url,
    v_category,
    jsonb_build_object(
      'os_id', NEW.os_id,
      'log_type', NEW.type,
      'actor_name', NEW.actor_name,
      'protocolo', v_protocolo,
      'cycle_kind', nullif(v_cycle_kind, ''),
      'cycle_ordinal', nullif(v_cycle_ordinal::text, '')
    )
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.insert_docagem_notification(p_type text, p_title text, p_message text, p_empresa_id uuid, p_actor_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_name TEXT;
  v_actor_avatar_url TEXT;
BEGIN
  SELECT nome, avatar_url
    INTO v_actor_name, v_actor_avatar_url
  FROM public.user_roles
  WHERE id = p_actor_id;

  INSERT INTO public.app_notifications (
    type, title, message, target_audience, empresa_id,
    created_by, created_by_name, created_by_avatar_url, metadata
  )
  VALUES (
    p_type, p_title, p_message, 'interno', p_empresa_id,
    p_actor_id, COALESCE(v_actor_name, 'Sistema'), v_actor_avatar_url, p_metadata
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.insert_os_atomic(p_os_data jsonb, p_waypoints jsonb DEFAULT '[]'::jsonb, p_operational_cycles jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_os_id uuid;
  v_wp jsonb;
  v_passenger jsonb;
  v_cycle jsonb;
  v_wp_id uuid;
  v_position integer := 0;
  v_imposto_percentual numeric;
  v_v_bruto numeric;
  v_v_custo numeric;
  v_no_show boolean;
  v_no_show_percentual numeric;
  v_no_show_fator numeric;
  v_hora_extra_text text;
  v_billed_minutes integer;
  v_hora_extra_cliente numeric;
  v_hora_extra_motorista numeric;
  v_base_cobranca numeric;
  v_repasse_efetivo numeric;
  v_imposto numeric;
  v_lucro numeric;
  v_actor_id uuid;
  v_actor_name text;
  v_tipo text;
  v_is_freelance boolean;
  v_status_op text;
  v_status_fin text;
BEGIN
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  v_actor_name := COALESCE(
    (SELECT nome FROM public.user_roles WHERE id = v_actor_id),
    'Sistema'
  );

  v_v_bruto := COALESCE((p_os_data->>'valor_bruto')::numeric, 0);
  v_v_custo := COALESCE((p_os_data->>'custo')::numeric, 0);
  v_no_show := COALESCE((p_os_data->>'no_show')::boolean, false);
  v_no_show_percentual :=
    CASE
      WHEN v_no_show THEN COALESCE(NULLIF(p_os_data->>'no_show_percentual', '')::numeric, 100)
      ELSE NULL
    END;
  v_no_show_fator := COALESCE(v_no_show_percentual, 100) / 100;

  v_hora_extra_text := COALESCE(p_os_data->>'hora_extra', '');
  v_billed_minutes := public.calc_hora_extra_billed_minutes(v_hora_extra_text);
  v_hora_extra_cliente := (v_billed_minutes::numeric / 60) * 50;
  v_hora_extra_motorista := (v_billed_minutes::numeric / 60) * 20;

  IF v_no_show THEN
    v_base_cobranca := (v_v_bruto + v_hora_extra_cliente) * v_no_show_fator;
    v_repasse_efetivo := (v_v_custo + v_hora_extra_motorista) * v_no_show_fator;
  ELSE
    v_base_cobranca := v_v_bruto + v_hora_extra_cliente;
    v_repasse_efetivo := v_v_custo + v_hora_extra_motorista;
  END IF;

  v_imposto_percentual := public.get_imposto_percentual_for_date(
    COALESCE(NULLIF(p_os_data->>'data', '')::date, CURRENT_DATE)
  );

  v_imposto := v_base_cobranca * (v_imposto_percentual / 100);
  v_lucro := v_base_cobranca - v_imposto - v_repasse_efetivo;

  v_tipo := COALESCE(NULLIF(p_os_data->>'tipo', ''), 'os');
  v_is_freelance := (v_tipo = 'freelance');

  IF v_tipo = 'rascunho' THEN
    v_status_op := 'Rascunho';
    v_status_fin := 'Rascunho';
  ELSE
    v_status_op := 'Pendente';
    v_status_fin := 'Pendente';
  END IF;

  INSERT INTO public.ordens_servico (
    protocolo, data, hora, hora_extra, no_show, no_show_percentual,
    os_number, cliente_id, solicitante, solicitante_id, centro_custo, centro_custo_id,
    motorista, driver_id, veiculo_id, valor_bruto, obs_financeiras,
    imposto, custo, lucro, status_operacional, status_financeiro,
    created_by, created_by_name, is_freelance, tipo,
    isento_valor_bruto, isento_custo, caixa_conta_id
  ) VALUES (
    '',
    COALESCE(NULLIF(p_os_data->>'data', '')::date, CURRENT_DATE),
    NULLIF(p_os_data->>'hora', ''),
    COALESCE(p_os_data->>'hora_extra', ''),
    v_no_show,
    CASE WHEN v_no_show THEN COALESCE(v_no_show_percentual::smallint, 100) ELSE NULL END,
    COALESCE(p_os_data->>'os_number', ''),
    NULLIF(p_os_data->>'cliente_id', '')::uuid,
    COALESCE(p_os_data->>'solicitante', ''),
    NULLIF(p_os_data->>'solicitante_id', '')::uuid,
    COALESCE(p_os_data->>'centro_custo', ''),
    NULLIF(p_os_data->>'centro_custo_id', '')::uuid,
    COALESCE(p_os_data->>'motorista', ''),
    NULLIF(p_os_data->>'driver_id', '')::uuid,
    NULLIF(p_os_data->>'veiculo_id', '')::uuid,
    v_v_bruto,
    COALESCE(p_os_data->>'obs_financeiras', ''),
    v_imposto,
    v_v_custo,
    v_lucro,
    v_status_op,
    v_status_fin,
    v_actor_id,
    v_actor_name,
    v_is_freelance,
    v_tipo,
    COALESCE((p_os_data->>'isento_valor_bruto')::boolean, false),
    COALESCE((p_os_data->>'isento_custo')::boolean, false),
    NULLIF(p_os_data->>'caixa_conta_id', '')::uuid
  )
  RETURNING id INTO v_os_id;

  IF p_operational_cycles IS NOT NULL AND jsonb_typeof(p_operational_cycles) = 'array' THEN
    FOR v_cycle IN SELECT * FROM jsonb_array_elements(p_operational_cycles)
    LOOP
      INSERT INTO public.os_operational_cycles (
        ordem_servico_id, itinerary_index, sequence_order, kind, ordinal, title, state,
        message_sent_at, accepted_at, started_at, finished_at, km_initial, km_final
      ) VALUES (
        v_os_id,
        COALESCE((v_cycle->>'itineraryIndex')::integer, 0),
        COALESCE((v_cycle->>'sequenceOrder')::integer, 0),
        COALESCE(v_cycle->>'kind', 'itinerary'),
        COALESCE((v_cycle->>'ordinal')::integer, 1),
        COALESCE(NULLIF(v_cycle->>'title', ''), ''),
        COALESCE(v_cycle->>'state', 'pending'),
        NULLIF(v_cycle->>'messageSentAt', '')::timestamptz,
        NULLIF(v_cycle->>'acceptedAt', '')::timestamptz,
        NULLIF(v_cycle->>'startedAt', '')::timestamptz,
        NULLIF(v_cycle->>'finishedAt', '')::timestamptz,
        NULLIF(v_cycle->>'kmInitial', '')::integer,
        NULLIF(v_cycle->>'kmFinal', '')::integer
      );
    END LOOP;
  END IF;

  IF p_waypoints IS NOT NULL AND jsonb_typeof(p_waypoints) = 'array' THEN
    FOR v_wp IN SELECT * FROM jsonb_array_elements(p_waypoints)
    LOOP
      INSERT INTO public.os_waypoints (
        ordem_servico_id, position, label, lat, lng, comment, itinerary_index, hora, data
      ) VALUES (
        v_os_id, v_position,
        COALESCE(v_wp->>'label', ''),
        NULLIF(v_wp->>'lat', '')::double precision,
        NULLIF(v_wp->>'lng', '')::double precision,
        COALESCE(v_wp->>'comment', ''),
        NULLIF(v_wp->>'itinerary_index', '')::integer,
        NULLIF(v_wp->>'hora', '')::time,
        NULLIF(v_wp->>'data', '')::date
      )
      RETURNING id INTO v_wp_id;

      IF jsonb_array_length(COALESCE(v_wp->'passengers', '[]'::jsonb)) > 0 THEN
        FOR v_passenger IN SELECT * FROM jsonb_array_elements(COALESCE(v_wp->'passengers', '[]'::jsonb))
        LOOP
          INSERT INTO public.os_waypoint_passengers (waypoint_id, passageiro_id)
          VALUES (v_wp_id, NULLIF(v_passenger->>'solicitante_id', '')::uuid);
        END LOOP;
      END IF;

      IF COALESCE(v_wp->>'comment', '') <> '' THEN
        INSERT INTO public.os_waypoint_comments (
          ordem_servico_id, waypoint_position, waypoint_label, comment
        ) VALUES (
          v_os_id,
          v_position,
          COALESCE(v_wp->>'label', ''),
          v_wp->>'comment'
        );
      END IF;

      v_position := v_position + 1;
    END LOOP;
  END IF;

  INSERT INTO public.os_logs (os_id, type, description, actor_name, actor_id, metadata)
  VALUES (v_os_id, 'create', 'Dados de cadastro do atendimento', v_actor_name, v_actor_id, '{}'::jsonb);

  RETURN v_os_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_chat_conversation_member(p_conversation_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = p_user_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_brazil_phone(raw_phone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g');

  if digits = '' then
    return coalesce(raw_phone, '');
  end if;

  if digits like '55%' and length(digits) > 11 then
    return digits;
  end if;

  if length(digits) <= 11 then
    return '55' || digits;
  end if;

  return digits;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_driver_phone_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.phone := public.normalize_brazil_phone(new.phone);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_parceiro_contato_celular_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.celular := public.normalize_brazil_phone(new.celular);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_parceiro_telefone_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.telefone := public.normalize_brazil_phone(new.telefone);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_passageiro_celular_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.celular := public.normalize_brazil_phone(new.celular);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_driver_km_finish(p_os_id uuid, p_cycle_index integer, p_km_final numeric, p_actor_name text, p_validate_km boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_cycles         JSONB;
  v_updated_cycles JSONB := '[]'::JSONB;
  v_cycle          JSONB;
  v_km_initial     NUMERIC;
  v_has_next_cycle BOOLEAN := false;
  v_next_cycle     JSONB;
  v_target_found   BOOLEAN := false;
  v_new_status     TEXT;
  v_result         JSONB;
BEGIN
  WITH locked_cycles AS (
    SELECT *
    FROM public.os_operational_cycles
    WHERE ordem_servico_id = p_os_id
    ORDER BY sequence_order
    FOR UPDATE
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'itineraryIndex', itinerary_index,
        'sequenceOrder',  sequence_order,
        'kind',           kind,
        'ordinal',        ordinal,
        'title',          title,
        'state',          state,
        'messageSentAt',  message_sent_at,
        'acceptedAt',     accepted_at,
        'startedAt',      started_at,
        'finishedAt',     finished_at,
        'kmInitial',      km_initial,
        'kmFinal',        km_final
      )
      ORDER BY sequence_order
    ),
    '[]'::JSONB
  )
  INTO v_cycles
  FROM locked_cycles;

  IF v_cycles IS NULL OR jsonb_array_length(v_cycles) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'NO_OPERATIONAL_CYCLES',
      'message', 'OS não possui ciclos operacionais cadastrados'
    );
  END IF;

  IF p_validate_km THEN
    FOR v_cycle IN SELECT * FROM jsonb_array_elements(v_cycles)
    LOOP
      IF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index THEN
        v_km_initial := COALESCE((v_cycle->>'kmInitial')::NUMERIC, 0);
        IF p_km_final <= v_km_initial THEN
          RETURN jsonb_build_object(
            'success',   false,
            'error',     'INVALID_KM',
            'message',   'KM final deve ser maior que KM inicial',
            'kmInitial', v_km_initial,
            'kmFinal',   p_km_final
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  FOR v_cycle IN SELECT * FROM jsonb_array_elements(v_cycles)
  LOOP
    IF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index THEN
      v_cycle := jsonb_set(v_cycle, '{kmFinal}',    to_jsonb(p_km_final),    true);
      v_cycle := jsonb_set(v_cycle, '{finishedAt}', to_jsonb(NOW()::TEXT),    true);
      v_cycle := jsonb_set(v_cycle, '{state}',      to_jsonb('completed'::TEXT), true);
      v_target_found := true;
    ELSIF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index + 1 THEN
      IF (v_cycle->>'state')::TEXT NOT IN ('completed', 'cancelled') THEN
        v_has_next_cycle := true;
        v_next_cycle     := v_cycle;
      END IF;
    END IF;
    v_updated_cycles := v_updated_cycles || jsonb_build_array(v_cycle);
  END LOOP;

  IF NOT v_target_found THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error',      'CYCLE_NOT_FOUND',
      'message',    'Ciclo operacional não encontrado para a OS informada',
      'cycleIndex', p_cycle_index
    );
  END IF;

  PERFORM public.replace_os_operational_cycles(p_os_id, v_updated_cycles);

  v_new_status := public.derive_os_operational_status_from_cycles(p_os_id);

  UPDATE public.ordens_servico
  SET
    status_operacional = v_new_status,
    route_finished_at  = NOW(),
    route_finished_km  = p_km_final
  WHERE id = p_os_id;

  INSERT INTO public.os_logs (os_id, type, actor_name, description, metadata)
  VALUES (
    p_os_id,
    'driver_finish',
    p_actor_name,
    'KM final registrado via flow: ' || p_km_final,
    jsonb_build_object(
      'cycleIndex', p_cycle_index,
      'kmFinal',    p_km_final,
      'kmInitial',  v_km_initial
    )
  );

  v_result := jsonb_build_object(
    'success',           true,
    'osId',              p_os_id,
    'cycleIndex',        p_cycle_index,
    'kmFinal',           p_km_final,
    'statusOperacional', v_new_status,
    'hasNextCycle',      v_has_next_cycle,
    'nextCycle',         v_next_cycle,
    'updatedCycles',     v_updated_cycles
  );

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.process_driver_km_start(p_os_id uuid, p_cycle_index integer, p_km_initial numeric, p_actor_name text, p_message_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_cycles         JSONB;
  v_updated_cycles JSONB := '[]'::JSONB;
  v_cycle          JSONB;
  v_target_found   BOOLEAN := false;
  v_result         JSONB;
BEGIN
  WITH locked_cycles AS (
    SELECT *
    FROM public.os_operational_cycles
    WHERE ordem_servico_id = p_os_id
    ORDER BY sequence_order
    FOR UPDATE
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'itineraryIndex', itinerary_index,
        'sequenceOrder',  sequence_order,
        'kind',           kind,
        'ordinal',        ordinal,
        'title',          title,
        'state',          state,
        'messageSentAt',  message_sent_at,
        'acceptedAt',     accepted_at,
        'startedAt',      started_at,
        'finishedAt',     finished_at,
        'kmInitial',      km_initial,
        'kmFinal',        km_final
      )
      ORDER BY sequence_order
    ),
    '[]'::JSONB
  )
  INTO v_cycles
  FROM locked_cycles;

  IF v_cycles IS NULL OR jsonb_array_length(v_cycles) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'NO_OPERATIONAL_CYCLES',
      'message', 'OS não possui ciclos operacionais cadastrados'
    );
  END IF;

  FOR v_cycle IN SELECT * FROM jsonb_array_elements(v_cycles)
  LOOP
    IF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index THEN
      v_cycle := jsonb_set(v_cycle, '{kmInitial}',  to_jsonb(p_km_initial),        true);
      v_cycle := jsonb_set(v_cycle, '{startedAt}',  to_jsonb(NOW()::TEXT),          true);
      v_cycle := jsonb_set(v_cycle, '{state}',      to_jsonb('awaiting_finish'::TEXT), true);
      v_cycle := jsonb_set(v_cycle, '{acceptedAt}', to_jsonb(NOW()::TEXT),          true);
      v_target_found := true;
    END IF;
    v_updated_cycles := v_updated_cycles || jsonb_build_array(v_cycle);
  END LOOP;

  IF NOT v_target_found THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error',      'CYCLE_NOT_FOUND',
      'message',    'Ciclo operacional não encontrado para a OS informada',
      'cycleIndex', p_cycle_index
    );
  END IF;

  PERFORM public.replace_os_operational_cycles(p_os_id, v_updated_cycles);

  UPDATE public.ordens_servico
  SET
    status_operacional = 'Em Rota',
    route_started_at   = NOW(),
    route_started_km   = p_km_initial
  WHERE id = p_os_id;

  INSERT INTO public.os_logs (os_id, type, actor_name, description, metadata)
  VALUES (
    p_os_id,
    'driver_start',
    p_actor_name,
    'KM inicial registrado via flow: ' || p_km_initial,
    jsonb_build_object(
      'cycleIndex', p_cycle_index,
      'kmInitial',  p_km_initial,
      'messageId',  p_message_id
    )
  );

  v_result := jsonb_build_object(
    'success',            true,
    'osId',               p_os_id,
    'cycleIndex',         p_cycle_index,
    'kmInitial',          p_km_initial,
    'statusOperacional',  'Em Rota',
    'updatedCycles',      v_updated_cycles
  );

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.promote_draft_to_os(p_os_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_actor_id uuid;
  v_actor_name text;
  v_actor_avatar_url text;
  v_new_status text;
  v_tipo text;
  v_cliente_id uuid;
  v_protocolo text;
  v_data text;
  v_solicitante_id text;
  v_driver_id text;
  v_veiculo_id text;
  v_missing text[];
BEGIN
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  v_actor_name := COALESCE(
    (SELECT nome FROM public.user_roles WHERE id = v_actor_id),
    'Sistema'
  );
  v_actor_avatar_url := (
    SELECT avatar_url FROM public.user_roles WHERE id = v_actor_id
  );

  SELECT tipo, cliente_id, protocolo, data, solicitante_id, driver_id, veiculo_id
    INTO v_tipo, v_cliente_id, v_protocolo, v_data, v_solicitante_id, v_driver_id, v_veiculo_id
  FROM public.ordens_servico
  WHERE id = p_os_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS % não encontrada', p_os_id;
  END IF;

  IF v_tipo <> 'rascunho' THEN
    RAISE EXCEPTION 'OS % não é um rascunho (tipo atual: %)', p_os_id, v_tipo;
  END IF;

  -- Validar campos obrigatórios antes de promover
  v_missing := ARRAY[]::text[];
  IF COALESCE(v_data, '') = '' THEN
    v_missing := array_append(v_missing, 'Data');
  END IF;
  IF COALESCE(v_cliente_id::text, '') = '' THEN
    v_missing := array_append(v_missing, 'Empresa');
  END IF;
  IF COALESCE(v_solicitante_id, '') = '' THEN
    v_missing := array_append(v_missing, 'Solicitante Responsável');
  END IF;
  IF COALESCE(v_driver_id, '') = '' THEN
    v_missing := array_append(v_missing, 'Motorista Alocado');
  END IF;
  IF COALESCE(v_veiculo_id, '') = '' THEN
    v_missing := array_append(v_missing, 'Veículo de Uso');
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'Campos obrigatórios faltando: %', array_to_string(v_missing, ', ');
  END IF;

  v_new_status := public.derive_os_operational_status_from_cycles(p_os_id);

  UPDATE public.ordens_servico
  SET
    tipo              = 'os',
    is_freelance      = false,
    status_operacional = v_new_status,
    status_financeiro = 'Pendente',
    updated_at        = NOW()
  WHERE id = p_os_id;

  INSERT INTO public.os_logs (os_id, type, description, actor_name, actor_id, metadata)
  VALUES (p_os_id, 'create', 'Rascunho promovido para OS', v_actor_name, v_actor_id,
    jsonb_build_object('action', 'promote_draft'));

  INSERT INTO public.app_notifications (
    type,
    title,
    message,
    target_audience,
    empresa_id,
    created_by,
    created_by_name,
    created_by_avatar_url,
    metadata
  )
  VALUES (
    'success',
    'Novo atendimento',
    format('OS %s cadastrada com sucesso. [OS_ID:%s]', COALESCE(v_protocolo, p_os_id::text), p_os_id),
    'interno',
    v_cliente_id,
    v_actor_id,
    v_actor_name,
    v_actor_avatar_url,
    jsonb_build_object('os_id', p_os_id, 'protocolo', v_protocolo, 'action', 'promote_draft')
  );

  RETURN p_os_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalc_caixa_saldo(p_conta_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE v_saldo_inicial NUMERIC; v_delta NUMERIC;
BEGIN
  SELECT COALESCE(saldo_inicial, 0) INTO v_saldo_inicial FROM public.caixa_contas WHERE id = p_conta_id;
  SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END), 0) INTO v_delta FROM public.caixa_lancamentos WHERE conta_id = p_conta_id;
  UPDATE public.caixa_contas SET saldo_atual = v_saldo_inicial + v_delta WHERE id = p_conta_id;
END; $function$
;

CREATE OR REPLACE FUNCTION public.recompute_docagem_pendencias(doc_row docagem_instancias)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_cliente_nome TEXT;
  v_protocolo TEXT;
  v_age_days INT;
  v_doc_cliente_id UUID;
BEGIN
  DELETE FROM public.system_pendencias
  WHERE source_type = 'docagem' AND source_id = doc_row.id;

  IF doc_row.data IS NULL OR doc_row.data >= v_today THEN RETURN; END IF;
  IF doc_row.status NOT IN ('pendente', 'andamento') THEN RETURN; END IF;

  SELECT protocolo, cliente_id INTO v_protocolo, v_doc_cliente_id
  FROM public.docagens WHERE id = doc_row.docagem_id;

  SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = v_doc_cliente_id;
  v_cliente_nome := COALESCE(v_cliente_nome, 'Cliente não informado');
  v_protocolo := COALESCE(v_protocolo, '');

  v_age_days := (v_today - doc_row.data)::int;

  INSERT INTO public.system_pendencias (source_type, source_id, motivo, protocolo, os_number, cliente_nome, data, age_days, itinerary_index)
  VALUES ('docagem', doc_row.id, 'docagem', v_protocolo, '', v_cliente_nome, doc_row.data::text, v_age_days, 0)
  ON CONFLICT (source_type, source_id, motivo, itinerary_index) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_os_pendencias(os_row ordens_servico)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_now_ts TIMESTAMP := (now() AT TIME ZONE 'America/Sao_Paulo');
  v_cliente_nome TEXT;
  v_age_days INT;
  v_itin RECORD;
  v_itin_date DATE;
  v_itin_dt TIMESTAMP;
  v_is_atrasada BOOLEAN;
  v_has_itineraries BOOLEAN := false;
  v_os_hora_time TIME;
BEGIN
  DELETE FROM public.system_pendencias
  WHERE source_type = 'os' AND source_id = os_row.id;

  IF os_row.arquivado THEN RETURN; END IF;

  SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = os_row.cliente_id;
  v_cliente_nome := COALESCE(v_cliente_nome, 'Cliente nao informado');

  v_os_hora_time := NULL;
  IF os_row.hora IS NOT NULL AND os_row.hora != '' AND os_row.hora ~ '^[0-9]{1,2}:[0-9]{2}' THEN
    BEGIN
      v_os_hora_time := os_row.hora::time;
    EXCEPTION WHEN OTHERS THEN
      v_os_hora_time := NULL;
    END;
  END IF;

  IF os_row.tipo = 'rascunho' THEN
    IF os_row.created_at IS NOT NULL THEN
      v_age_days := extract(epoch from (now() - os_row.created_at))::int / 86400;
      IF v_age_days >= 1 THEN
        INSERT INTO public.system_pendencias
          (source_type, source_id, motivo, protocolo, os_number, cliente_nome, data, user_id, age_days, itinerary_index)
        VALUES
          ('os', os_row.id, 'rascunho', COALESCE(os_row.protocolo,''), COALESCE(os_row.os_number,''), v_cliente_nome, COALESCE(os_row.data::text,''), os_row.created_by, v_age_days, 0)
        ON CONFLICT (source_type, source_id, motivo, itinerary_index) DO NOTHING;
      END IF;
    END IF;
    RETURN;
  END IF;

  IF os_row.status_operacional = 'Finalizado' THEN
    IF (
      (NOT COALESCE(os_row.isento_valor_bruto, false) AND (os_row.valor_bruto IS NULL OR os_row.valor_bruto = 0))
      OR
      (NOT COALESCE(os_row.isento_custo, false) AND (os_row.custo IS NULL OR os_row.custo = 0))
    ) THEN
      INSERT INTO public.system_pendencias
        (source_type, source_id, motivo, protocolo, os_number, cliente_nome, data, itinerary_index)
      VALUES
        ('os', os_row.id, 'sem_valor', COALESCE(os_row.protocolo,''), COALESCE(os_row.os_number,''), v_cliente_nome, COALESCE(os_row.data::text,''), 0)
      ON CONFLICT (source_type, source_id, motivo, itinerary_index) DO NOTHING;
    END IF;
  END IF;

  FOR v_itin IN
    SELECT DISTINCT ON (COALESCE(w.itinerary_index, 0))
      COALESCE(w.itinerary_index, 0)          AS itinerary_index,
      COALESCE(w.data, os_row.data)            AS itin_data,
      COALESCE(w.hora, v_os_hora_time)         AS itin_hora
    FROM public.os_waypoints w
    WHERE w.ordem_servico_id = os_row.id
    ORDER BY COALESCE(w.itinerary_index, 0) ASC, w.position ASC
  LOOP
    v_has_itineraries := true;
    v_itin_date := v_itin.itin_data;
    IF v_itin_date IS NULL THEN CONTINUE; END IF;

    v_is_atrasada := false;

    IF v_itin_date < v_today THEN
      IF os_row.status_operacional NOT IN ('Finalizado', 'Cancelado') THEN
        v_is_atrasada := true;
      END IF;
    ELSIF v_itin_date = v_today THEN
      IF os_row.status_operacional IN ('Pendente', 'Aguardando') THEN
        IF v_itin.itin_hora IS NOT NULL THEN
          BEGIN
            v_itin_dt := (v_itin_date::text || ' ' || v_itin.itin_hora::text)::timestamp;
            IF v_now_ts >= v_itin_dt THEN
              v_is_atrasada := true;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            v_is_atrasada := true;
          END;
        ELSE
          v_is_atrasada := true;
        END IF;
      END IF;
    END IF;

    IF v_is_atrasada THEN
      INSERT INTO public.system_pendencias
        (source_type, source_id, motivo, protocolo, os_number, cliente_nome, data, itinerary_index)
      VALUES
        ('os', os_row.id, 'atrasada', COALESCE(os_row.protocolo,''), COALESCE(os_row.os_number,''), v_cliente_nome, v_itin_date::text, v_itin.itinerary_index)
      ON CONFLICT (source_type, source_id, motivo, itinerary_index) DO NOTHING;
    END IF;
  END LOOP;

  IF NOT v_has_itineraries AND os_row.data IS NOT NULL THEN
    v_is_atrasada := false;

    IF os_row.data < v_today THEN
      IF os_row.status_operacional NOT IN ('Finalizado', 'Cancelado') THEN
        v_is_atrasada := true;
      END IF;
    ELSIF os_row.data = v_today THEN
      IF os_row.status_operacional IN ('Pendente', 'Aguardando') THEN
        IF v_os_hora_time IS NOT NULL THEN
          BEGIN
            v_itin_dt := (os_row.data::text || ' ' || v_os_hora_time::text)::timestamp;
            IF v_now_ts >= v_itin_dt THEN
              v_is_atrasada := true;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            v_is_atrasada := true;
          END;
        ELSE
          v_is_atrasada := true;
        END IF;
      END IF;
    END IF;

    IF v_is_atrasada THEN
      INSERT INTO public.system_pendencias
        (source_type, source_id, motivo, protocolo, os_number, cliente_nome, data, itinerary_index)
      VALUES
        ('os', os_row.id, 'atrasada', COALESCE(os_row.protocolo,''), COALESCE(os_row.os_number,''), v_cliente_nome, os_row.data::text, 0)
      ON CONFLICT (source_type, source_id, motivo, itinerary_index) DO NOTHING;
    END IF;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reconcile_all_pendencias()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_os public.ordens_servico;
  v_doc public.docagem_instancias;
BEGIN
  -- Remove pendencias de OS arquivadas ou inexistentes (ao invés de apagar tudo)
  DELETE FROM public.system_pendencias sp
  WHERE sp.source_type = 'os'
    AND NOT EXISTS (
      SELECT 1 FROM public.ordens_servico o
      WHERE o.id = sp.source_id AND o.arquivado = false
    );

  -- Recomputa apenas OS ativas (recompute_os_pendencias faz DELETE+INSERT por OS)
  FOR v_os IN
    SELECT * FROM public.ordens_servico WHERE arquivado = false
  LOOP
    PERFORM public.recompute_os_pendencias(v_os);
  END LOOP;

  -- Remove pendencias de docagem resolvidas ou inexistentes
  DELETE FROM public.system_pendencias sp
  WHERE sp.source_type = 'docagem'
    AND NOT EXISTS (
      SELECT 1 FROM public.docagem_instancias d
      WHERE d.id = sp.source_id
        AND d.data < v_today
        AND d.status IN ('pendente', 'andamento')
    );

  -- Recomputa docagens pendentes/em andamento atrasadas
  FOR v_doc IN
    SELECT * FROM public.docagem_instancias
    WHERE data < v_today AND status IN ('pendente', 'andamento')
  LOOP
    PERFORM public.recompute_docagem_pendencias(v_doc);
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.record_webhook_metric(p_event_type text, p_os_id uuid DEFAULT NULL::uuid, p_phone text DEFAULT NULL::text, p_duration_ms integer DEFAULT NULL::integer, p_success boolean DEFAULT true, p_error_message text DEFAULT NULL::text, p_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_metric_id UUID;
BEGIN
  INSERT INTO public.webhook_metrics (event_type, os_id, phone, duration_ms, success, error_message, metadata)
  VALUES (p_event_type, p_os_id, p_phone, p_duration_ms, p_success, p_error_message, p_metadata)
  RETURNING id INTO v_metric_id;
  RETURN v_metric_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.replace_os_operational_cycles(p_os_id uuid, p_cycles jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_cycle jsonb;
begin
  delete from public.os_operational_cycles
  where ordem_servico_id = p_os_id;

  if p_cycles is null or jsonb_typeof(p_cycles) <> 'array' or jsonb_array_length(p_cycles) = 0 then
    return;
  end if;

  for v_cycle in select * from jsonb_array_elements(p_cycles)
  loop
    insert into public.os_operational_cycles (
      ordem_servico_id,
      itinerary_index,
      sequence_order,
      kind,
      ordinal,
      title,
      state,
      message_sent_at,
      message_sent_by_id,
      accepted_at,
      started_at,
      finished_at,
      km_initial,
      km_final
    ) values (
      p_os_id,
      coalesce((v_cycle->>'itineraryIndex')::integer, 0),
      coalesce((v_cycle->>'sequenceOrder')::integer, 0),
      coalesce(v_cycle->>'kind', 'itinerary'),
      coalesce((v_cycle->>'ordinal')::integer, 1),
      coalesce(nullif(v_cycle->>'title', ''), ''),
      coalesce(v_cycle->>'state', 'pending'),
      nullif(v_cycle->>'messageSentAt', '')::timestamptz,
      nullif(v_cycle->>'messageSentById', '')::uuid,
      nullif(v_cycle->>'acceptedAt', '')::timestamptz,
      nullif(v_cycle->>'startedAt', '')::timestamptz,
      nullif(v_cycle->>'finishedAt', '')::timestamptz,
      nullif(v_cycle->>'kmInitial', '')::integer,
      nullif(v_cycle->>'kmFinal', '')::integer
    );
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.resetar_docagem_dia(p_instancia_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_instancia public.docagem_instancias%ROWTYPE;
BEGIN
  SELECT * INTO v_instancia
  FROM public.docagem_instancias
  WHERE id = p_instancia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Instância de docagem não encontrada.';
  END IF;

  IF v_instancia.status != 'finalizada' THEN
    RAISE EXCEPTION 'Apenas instâncias finalizadas podem ser resetadas.';
  END IF;

  DELETE FROM public.docagem_lancamentos
  WHERE docagem_instancia_id = p_instancia_id;

  UPDATE public.docagem_instancias
  SET status = 'pendente',
      finalizada_em = NULL,
      finalizada_por = NULL
  WHERE id = p_instancia_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_caixa_default_conta()
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_conta_id UUID;
BEGIN
  SELECT id INTO v_conta_id
  FROM public.caixa_contas
  WHERE is_default = TRUE AND ativa = TRUE
  LIMIT 1;

  IF v_conta_id IS NULL THEN
    SELECT id INTO v_conta_id
    FROM public.caixa_contas
    WHERE ativa = TRUE
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  RETURN v_conta_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.save_fornecedor(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_fornecedor_id uuid;
  contato jsonb;
  filial jsonb;
  response jsonb;
BEGIN
  IF COALESCE(NULLIF(BTRIM(payload->>'nome'), ''), '') = '' THEN
    RAISE EXCEPTION 'Informe o nome do fornecedor.';
  END IF;

  IF COALESCE(NULLIF(BTRIM(payload->>'pessoa_tipo'), ''), '') NOT IN ('fisica', 'juridica') THEN
    RAISE EXCEPTION 'Tipo de pessoa inválido.';
  END IF;

  IF COALESCE(NULLIF(BTRIM(payload->>'documento'), ''), '') = '' THEN
    RAISE EXCEPTION 'Informe o documento do fornecedor.';
  END IF;

  IF COALESCE(NULLIF(BTRIM(payload->>'razao_social_ou_nome_completo'), ''), '') = '' THEN
    RAISE EXCEPTION 'Informe a razão social ou nome completo do fornecedor.';
  END IF;

  IF payload ? 'id' AND COALESCE(NULLIF(BTRIM(payload->>'id'), ''), '') <> '' THEN
    v_fornecedor_id := (payload->>'id')::uuid;

    UPDATE public.fornecedores
      SET nome = BTRIM(payload->>'nome'),
          tipo = BTRIM(payload->>'tipo'),
          pessoa_tipo = payload->>'pessoa_tipo',
          documento = BTRIM(payload->>'documento'),
          razao_social_ou_nome_completo = BTRIM(payload->>'razao_social_ou_nome_completo'),
          updated_at = timezone('utc'::text, now())
    WHERE id = v_fornecedor_id;

    DELETE FROM public.fornecedores_contatos
      WHERE fornecedor_id = v_fornecedor_id;
    DELETE FROM public.fornecedores_filiais
      WHERE fornecedor_id = v_fornecedor_id;
  ELSE
    INSERT INTO public.fornecedores (
      nome,
      tipo,
      pessoa_tipo,
      documento,
      razao_social_ou_nome_completo
    ) VALUES (
      BTRIM(payload->>'nome'),
      BTRIM(payload->>'tipo'),
      payload->>'pessoa_tipo',
      BTRIM(payload->>'documento'),
      BTRIM(payload->>'razao_social_ou_nome_completo')
    )
    RETURNING id INTO v_fornecedor_id;
  END IF;

  FOR contato IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'contatos', '[]'::jsonb)) LOOP
    INSERT INTO public.fornecedores_contatos (
      fornecedor_id,
      setor,
      celular,
      email,
      responsavel
    ) VALUES (
      v_fornecedor_id,
      BTRIM(COALESCE(contato->>'setor', '')),
      BTRIM(COALESCE(contato->>'celular', '')),
      NULLIF(BTRIM(COALESCE(contato->>'email', '')), ''),
      BTRIM(COALESCE(contato->>'responsavel', ''))
    );
  END LOOP;

  FOR filial IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'filiais', '[]'::jsonb)) LOOP
    INSERT INTO public.fornecedores_filiais (
      fornecedor_id,
      rotulo,
      endereco_completo,
      referencia
    ) VALUES (
      v_fornecedor_id,
      NULLIF(BTRIM(COALESCE(filial->>'rotulo', '')), ''),
      BTRIM(COALESCE(filial->>'endereco_completo', '')),
      NULLIF(BTRIM(COALESCE(filial->>'referencia', '')), '')
    );
  END LOOP;

  SELECT jsonb_build_object(
    'id', f.id,
    'nome', f.nome,
    'tipo', f.tipo,
    'pessoa_tipo', f.pessoa_tipo,
    'documento', f.documento,
    'razao_social_ou_nome_completo', f.razao_social_ou_nome_completo,
    'telefone', f.telefone,
    'contatos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'setor', c.setor,
        'celular', c.celular,
        'email', c.email,
        'responsavel', c.responsavel
      ) ORDER BY c.created_at)
      FROM public.fornecedores_contatos c
      WHERE c.fornecedor_id = f.id
    ), '[]'::jsonb),
    'filiais', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', fi.id,
        'rotulo', fi.rotulo,
        'endereco_completo', fi.endereco_completo,
        'referencia', fi.referencia
      ) ORDER BY fi.created_at)
      FROM public.fornecedores_filiais fi
      WHERE fi.fornecedor_id = f.id
    ), '[]'::jsonb)
  )
  INTO response
  FROM public.fornecedores f
  WHERE f.id = v_fornecedor_id;

  RETURN response;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_caixa_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_limit(real)
 RETURNS real
 LANGUAGE c
 STRICT
AS '$libdir/pg_trgm', $function$set_limit$function$
;

CREATE OR REPLACE FUNCTION public.set_os_operational_cycles_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.show_limit()
 RETURNS real
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$show_limit$function$
;

CREATE OR REPLACE FUNCTION public.show_trgm(text)
 RETURNS text[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$show_trgm$function$
;

CREATE OR REPLACE FUNCTION public.similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity$function$
;

CREATE OR REPLACE FUNCTION public.similarity_dist(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity_dist$function$
;

CREATE OR REPLACE FUNCTION public.similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity_op$function$
;

CREATE OR REPLACE FUNCTION public.strict_word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity$function$
;

CREATE OR REPLACE FUNCTION public.strict_word_similarity_commutator_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_commutator_op$function$
;

CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_commutator_op$function$
;

CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_op$function$
;

CREATE OR REPLACE FUNCTION public.strict_word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_op$function$
;

CREATE OR REPLACE FUNCTION public.trigger_caixa_contas_saldo_init()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.saldo_inicial IS DISTINCT FROM OLD.saldo_inicial THEN
    PERFORM public.recalc_caixa_saldo(NEW.id);
  END IF;
  RETURN NEW;
END; $function$
;

CREATE OR REPLACE FUNCTION public.trigger_caixa_espelhar_recebimento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_conta_id UUID; v_valor NUMERIC;
BEGIN
  IF NEW.status_financeiro IS DISTINCT FROM OLD.status_financeiro AND NEW.status_financeiro = 'Recebido' THEN
    v_conta_id := COALESCE(NEW.caixa_conta_id, public.resolve_caixa_default_conta());
    IF v_conta_id IS NULL THEN RETURN NEW; END IF;
    v_valor := COALESCE(NEW.valor_bruto, 0);
    IF v_valor <= 0 THEN RETURN NEW; END IF;
    INSERT INTO public.caixa_lancamentos (conta_id, tipo, valor, data, descricao, categoria, forma_pagamento, cliente_id, os_id, origem)
    VALUES (v_conta_id, 'entrada', v_valor, COALESCE((NEW.financeiro_recebido_em AT TIME ZONE 'America/Sao_Paulo')::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date), COALESCE('Recebimento OS ' || NEW.protocolo, 'Recebimento de OS'), 'recebimento_cliente', 'outro', NEW.cliente_id, NEW.id, 'os_recebimento')
    ON CONFLICT (os_id, origem) WHERE origem IN ('os_recebimento','os_repasse') DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$
;

CREATE OR REPLACE FUNCTION public.trigger_caixa_espelhar_repasse()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_conta_id UUID; v_valor NUMERIC;
BEGIN
  IF (NEW.repasse_pago IS TRUE) AND (OLD.repasse_pago IS NOT TRUE) AND NEW.repasse_pago IS DISTINCT FROM OLD.repasse_pago THEN
    v_conta_id := COALESCE(NEW.caixa_conta_id, public.resolve_caixa_default_conta());
    IF v_conta_id IS NULL THEN RETURN NEW; END IF;
    v_valor := COALESCE(NEW.custo, 0);
    IF v_valor <= 0 THEN RETURN NEW; END IF;
    INSERT INTO public.caixa_lancamentos (conta_id, tipo, valor, data, descricao, categoria, forma_pagamento, driver_id, os_id, origem)
    VALUES (v_conta_id, 'saida', v_valor, (now() AT TIME ZONE 'America/Sao_Paulo')::date, COALESCE('Repasse motorista OS ' || NEW.protocolo, 'Repasse ao motorista'), 'repasse_motorista', 'outro', NEW.driver_id, NEW.id, 'os_repasse')
    ON CONFLICT (os_id, origem) WHERE origem IN ('os_recebimento','os_repasse') DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$
;

CREATE OR REPLACE FUNCTION public.trigger_caixa_recalc_saldo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE v_old_conta UUID; v_new_conta UUID;
BEGIN
  v_old_conta := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.conta_id END;
  v_new_conta := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.conta_id END;
  IF v_old_conta IS NOT NULL AND v_old_conta IS DISTINCT FROM v_new_conta THEN
    PERFORM public.recalc_caixa_saldo(v_old_conta);
  END IF;
  IF v_new_conta IS NOT NULL THEN
    PERFORM public.recalc_caixa_saldo(v_new_conta);
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $function$
;

CREATE OR REPLACE FUNCTION public.trigger_docagem_pendencias()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.system_pendencias WHERE source_type = 'docagem' AND source_id = OLD.id;
    RETURN OLD;
  ELSIF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    PERFORM public.recompute_docagem_pendencias(NEW);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_os_pendencias()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.system_pendencias WHERE source_type = 'os' AND source_id = OLD.id;
    RETURN OLD;
  ELSIF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    PERFORM public.recompute_os_pendencias(NEW);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_waypoint_pendencias()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_os public.ordens_servico;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    SELECT * INTO v_os FROM public.ordens_servico WHERE id = OLD.ordem_servico_id;
    IF v_os.id IS NOT NULL THEN
      PERFORM public.recompute_os_pendencias(v_os);
    END IF;
    RETURN OLD;
  ELSIF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    SELECT * INTO v_os FROM public.ordens_servico WHERE id = NEW.ordem_servico_id;
    IF v_os.id IS NOT NULL THEN
      PERFORM public.recompute_os_pendencias(v_os);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.unarchive_os_atomic(p_os_id uuid, p_os_label text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_actor_id uuid;
  v_actor_name text;
  v_tipo text;
  v_is_draft boolean;
BEGIN
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  v_actor_name := COALESCE(
    (SELECT nome FROM public.user_roles WHERE id = v_actor_id),
    'Sistema'
  );

  SELECT tipo INTO v_tipo
  FROM public.ordens_servico
  WHERE id = p_os_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS % não encontrada', p_os_id;
  END IF;

  v_is_draft := (v_tipo = 'rascunho');

  UPDATE public.ordens_servico
  SET
    arquivado = false,
    status_operacional = CASE WHEN v_is_draft THEN 'Rascunho' ELSE 'Pendente' END,
    status_financeiro = CASE WHEN v_is_draft THEN 'Rascunho' ELSE 'Pendente' END,
    updated_at = NOW()
  WHERE id = p_os_id;

  INSERT INTO public.os_logs (os_id, type, description, actor_name, actor_id, metadata)
  VALUES (
    p_os_id,
    'unarchive',
    CASE WHEN v_is_draft
      THEN 'Rascunho reaberto' || CASE WHEN p_os_label IS NOT NULL AND p_os_label <> '' THEN ' — ' || p_os_label ELSE '' END
      ELSE 'OS reaberta' || CASE WHEN p_os_label IS NOT NULL AND p_os_label <> '' THEN ' — ' || p_os_label ELSE '' END
    END,
    v_actor_name,
    v_actor_id,
    jsonb_build_object('action', 'unarchive', 'tipo', v_tipo)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_conversation_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.chat_conversations 
  SET updated_at = now() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_driver_vehicles_atomic(p_driver_id uuid, p_vehicle_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_vehicle_id UUID;
BEGIN
  -- 1. Deletar vínculos antigos
  DELETE FROM public.driver_vehicles WHERE driver_id = p_driver_id;

  -- 2. Inserir novos vínculos
  FOREACH v_vehicle_id IN ARRAY p_vehicle_ids
  LOOP
    INSERT INTO public.driver_vehicles (driver_id, vehicle_id)
    VALUES (p_driver_id, v_vehicle_id);
  END LOOP;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_fornecedores_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_os_atomic(p_os_id uuid, p_os_data jsonb, p_waypoints jsonb, p_operational_cycles jsonb DEFAULT '[]'::jsonb, p_log_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_v_bruto numeric;
  v_v_custo numeric;
  v_no_show boolean;
  v_no_show_percentual numeric;
  v_no_show_fator numeric;
  v_hora_extra_text text;
  v_billed_minutes integer;
  v_hora_extra_cliente numeric;
  v_hora_extra_motorista numeric;
  v_base_cobranca numeric;
  v_repasse_efetivo numeric;
  v_imposto_percentual numeric;
  v_actor_id uuid;
  v_actor_name text;
  v_log_description text;
  v_changed_sections text;
  v_changed_fields text;
  v_new_status text;
  v_tipo text;
BEGIN
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  v_actor_name := COALESCE(
    (SELECT nome FROM public.user_roles WHERE id = v_actor_id),
    'Sistema'
  );

  IF p_log_metadata IS NOT NULL
     AND jsonb_typeof(p_log_metadata) = 'object'
     AND p_log_metadata ? 'field_changes'
     AND jsonb_typeof(p_log_metadata->'field_changes') = 'array'
     AND jsonb_array_length(p_log_metadata->'field_changes') > 0
  THEN
    SELECT string_agg(v_item, ' | ')
      INTO v_changed_fields
    FROM (
      SELECT
        CASE
          WHEN COALESCE(fc_elem.fc->>'action', '') = 'added' THEN
            COALESCE(fc_elem.fc->>'field', 'Campo') || ' adicionado'
          WHEN COALESCE(fc_elem.fc->>'action', '') = 'removed' THEN
            COALESCE(fc_elem.fc->>'field', 'Campo') || ' removido'
          ELSE
            COALESCE(fc_elem.fc->>'field', 'Campo') || ' alterado'
        END AS v_item
      FROM (
        SELECT value::jsonb AS fc
        FROM jsonb_array_elements(p_log_metadata->'field_changes')
      ) fc_elem
    ) mapped
    WHERE v_item IS NOT NULL AND v_item <> '';
  END IF;

  IF p_log_metadata IS NOT NULL
     AND jsonb_typeof(p_log_metadata) = 'object'
     AND p_log_metadata ? 'changed_sections'
     AND jsonb_typeof(p_log_metadata->'changed_sections') = 'array'
  THEN
    SELECT string_agg(sec_elem.sec, ', ')
      INTO v_changed_sections
    FROM (
      SELECT value::text AS sec
      FROM jsonb_array_elements_text(p_log_metadata->'changed_sections')
    ) sec_elem;
  END IF;

  IF v_changed_fields IS NOT NULL AND v_changed_fields <> '' THEN
    v_log_description := 'Atualizacao: ' || v_changed_fields;
  ELSIF v_changed_sections IS NOT NULL AND v_changed_sections <> '' THEN
    v_log_description := 'Atualizacao em: ' || v_changed_sections;
  ELSE
    v_log_description := 'Dados de edicao do atendimento';
  END IF;

  v_v_bruto := COALESCE((p_os_data->>'valor_bruto')::numeric, 0);
  v_v_custo := COALESCE((p_os_data->>'custo')::numeric, 0);
  v_no_show := COALESCE((p_os_data->>'no_show')::boolean, false);
  v_no_show_percentual :=
    CASE
      WHEN v_no_show THEN COALESCE(NULLIF(p_os_data->>'no_show_percentual', ''), '100')::numeric
      ELSE NULL
    END;
  v_no_show_fator := COALESCE(v_no_show_percentual, 100) / 100;

  v_hora_extra_text := COALESCE(p_os_data->>'hora_extra', '');
  v_billed_minutes := public.calc_hora_extra_billed_minutes(v_hora_extra_text);
  v_hora_extra_cliente := (v_billed_minutes::numeric / 60) * 50;
  v_hora_extra_motorista := (v_billed_minutes::numeric / 60) * 20;

  IF v_no_show THEN
    v_base_cobranca := (v_v_bruto + v_hora_extra_cliente) * v_no_show_fator;
    v_repasse_efetivo := (v_v_custo + v_hora_extra_motorista) * v_no_show_fator;
  ELSE
    v_base_cobranca := v_v_bruto + v_hora_extra_cliente;
    v_repasse_efetivo := v_v_custo + v_hora_extra_motorista;
  END IF;

  v_imposto_percentual := public.get_imposto_percentual_for_date(
    COALESCE(NULLIF(p_os_data->>'data', '')::date, CURRENT_DATE)
  );

  SELECT tipo INTO v_tipo FROM public.ordens_servico WHERE id = p_os_id;
  v_tipo := COALESCE(NULLIF(p_os_data->>'tipo', ''), v_tipo);
  IF v_tipo IS NULL OR v_tipo NOT IN ('os', 'freelance', 'rascunho') THEN
    v_tipo := 'os';
  END IF;

  UPDATE public.ordens_servico
  SET
    data                = (p_os_data->>'data')::date,
    hora                = NULLIF(p_os_data->>'hora', ''),
    hora_extra          = COALESCE(p_os_data->>'hora_extra', ''),
    no_show             = v_no_show,
    no_show_percentual  = CASE WHEN v_no_show THEN COALESCE(v_no_show_percentual::smallint, 100) ELSE NULL END,
    os_number           = COALESCE(p_os_data->>'os_number', ''),
    cliente_id          = NULLIF(p_os_data->>'cliente_id', '')::uuid,
    solicitante         = COALESCE(p_os_data->>'solicitante', ''),
    solicitante_id      = NULLIF(p_os_data->>'solicitante_id', '')::uuid,
    centro_custo        = COALESCE(p_os_data->>'centro_custo', ''),
    centro_custo_id     = NULLIF(p_os_data->>'centro_custo_id', '')::uuid,
    motorista           = COALESCE(p_os_data->>'motorista', ''),
    driver_id           = NULLIF(p_os_data->>'driver_id', '')::uuid,
    veiculo_id          = NULLIF(p_os_data->>'veiculo_id', '')::uuid,
    valor_bruto         = v_v_bruto,
    obs_financeiras     = COALESCE(p_os_data->>'obs_financeiras', ''),
    imposto             = v_base_cobranca * (v_imposto_percentual / 100),
    custo               = v_v_custo,
    lucro               = v_base_cobranca - (v_base_cobranca * (v_imposto_percentual / 100)) - v_repasse_efetivo,
    tipo                = v_tipo,
    is_freelance        = (v_tipo = 'freelance'),
    isento_valor_bruto  = COALESCE((p_os_data->>'isento_valor_bruto')::boolean, false),
    isento_custo        = COALESCE((p_os_data->>'isento_custo')::boolean, false),
    caixa_conta_id      = NULLIF(p_os_data->>'caixa_conta_id', '')::uuid,
    updated_at          = NOW()
  WHERE id = p_os_id;

  DELETE FROM public.os_operational_cycles WHERE ordem_servico_id = p_os_id;

  IF p_operational_cycles IS NOT NULL AND jsonb_typeof(p_operational_cycles) = 'array' THEN
    INSERT INTO public.os_operational_cycles (
      ordem_servico_id, itinerary_index, sequence_order, kind, ordinal, title, state,
      message_sent_at, accepted_at, started_at, finished_at, km_initial, km_final
    )
    SELECT
      p_os_id,
      COALESCE((elem->>'itineraryIndex')::integer, 0),
      COALESCE((elem->>'sequenceOrder')::integer, 0),
      COALESCE(elem->>'kind', 'itinerary'),
      COALESCE((elem->>'ordinal')::integer, 1),
      COALESCE(NULLIF(elem->>'title', ''), ''),
      COALESCE(elem->>'state', 'pending'),
      NULLIF(elem->>'messageSentAt', '')::timestamptz,
      NULLIF(elem->>'acceptedAt', '')::timestamptz,
      NULLIF(elem->>'startedAt', '')::timestamptz,
      NULLIF(elem->>'finishedAt', '')::timestamptz,
      NULLIF(elem->>'kmInitial', '')::integer,
      NULLIF(elem->>'kmFinal', '')::integer
    FROM jsonb_array_elements(p_operational_cycles) AS elem_row(elem);
  END IF;

  v_new_status := public.derive_os_operational_status_from_cycles(p_os_id);
  UPDATE public.ordens_servico
  SET status_operacional = v_new_status, updated_at = NOW()
  WHERE id = p_os_id;

  DELETE FROM public.os_waypoints WHERE ordem_servico_id = p_os_id;

  IF p_waypoints IS NOT NULL AND jsonb_typeof(p_waypoints) = 'array' THEN
    WITH inserted_waypoints AS (
      INSERT INTO public.os_waypoints (
        ordem_servico_id, position, label, lat, lng, comment, itinerary_index, hora, data
      )
      SELECT
        p_os_id,
        row_number() OVER () - 1,
        COALESCE(wp_row.elem->>'label', ''),
        NULLIF(wp_row.elem->>'lat', '')::double precision,
        NULLIF(wp_row.elem->>'lng', '')::double precision,
        COALESCE(wp_row.elem->>'comment', ''),
        NULLIF(wp_row.elem->>'itinerary_index', '')::integer,
        NULLIF(wp_row.elem->>'hora', '')::time,
        NULLIF(wp_row.elem->>'data', '')::date
      FROM jsonb_array_elements(p_waypoints) AS wp_row(elem)
      RETURNING id, position
    )
    INSERT INTO public.os_waypoint_passengers (waypoint_id, passageiro_id)
    SELECT iw.id, NULLIF(p_elem.pax->>'solicitante_id', '')::uuid
    FROM inserted_waypoints iw
    JOIN (
      SELECT
        (row_number() OVER () - 1)::integer AS pos,
        wp_row2.elem AS wp_elem
      FROM jsonb_array_elements(p_waypoints) AS wp_row2(elem)
    ) wp_pos ON iw.position = wp_pos.pos
    JOIN jsonb_array_elements(wp_pos.wp_elem->'passengers') AS p_elem(pax) ON true
    WHERE jsonb_array_length(COALESCE(wp_pos.wp_elem->'passengers', '[]'::jsonb)) > 0;
  END IF;

  INSERT INTO public.os_logs (os_id, type, description, actor_name, actor_id, metadata)
  VALUES (
    p_os_id,
    'update',
    v_log_description,
    v_actor_name,
    v_actor_id,
    COALESCE(p_log_metadata, '{}'::jsonb)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_os_status_atomic(p_os_id uuid, p_operacional text DEFAULT NULL::text, p_financeiro text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_actor_id uuid;
  v_actor_name text;
  v_parts text[] := ARRAY[]::text[];
BEGIN
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  v_actor_name := COALESCE(
    (SELECT nome FROM public.user_roles WHERE id = v_actor_id),
    'Sistema'
  );

  IF p_operacional IS NOT NULL THEN
    UPDATE public.ordens_servico SET status_operacional = p_operacional WHERE id = p_os_id;
    v_parts := array_append(v_parts, format('Status operacional alterado para "%s"', p_operacional));
  END IF;

  IF p_financeiro IS NOT NULL THEN
    UPDATE public.ordens_servico SET status_financeiro = p_financeiro WHERE id = p_os_id;
    v_parts := array_append(v_parts, format('Status financeiro alterado para "%s"', p_financeiro));
  END IF;

  IF array_length(v_parts, 1) > 0 THEN
    INSERT INTO public.os_logs (os_id, type, description, actor_name, actor_id, metadata)
    VALUES (
      p_os_id,
      'status_change',
      array_to_string(v_parts, ' | '),
      v_actor_name,
      v_actor_id,
      jsonb_build_object('updates', jsonb_build_object('operacional', p_operacional, 'financeiro', p_financeiro))
    );
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_parceiro_atomic(p_parceiro_id uuid, p_nome text, p_pessoa_tipo text, p_documento text, p_razao_social_ou_nome_completo text, p_contatos jsonb, p_filiais jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_contato JSONB;
  v_filial JSONB;
BEGIN
  UPDATE public.parceiros_servico SET
    nome = p_nome,
    pessoa_tipo = p_pessoa_tipo,
    documento = p_documento,
    razao_social_ou_nome_completo = p_razao_social_ou_nome_completo,
    updated_at = NOW()
  WHERE id = p_parceiro_id;

  DELETE FROM public.parceiros_contatos WHERE parceiro_id = p_parceiro_id;
  DELETE FROM public.parceiros_filiais WHERE parceiro_id = p_parceiro_id;

  FOR v_contato IN SELECT * FROM jsonb_array_elements(p_contatos)
  LOOP
    INSERT INTO public.parceiros_contatos (
      parceiro_id, setor, celular, email, responsavel
    ) VALUES (
      p_parceiro_id,
      v_contato->>'setor',
      v_contato->>'celular',
      v_contato->>'email',
      v_contato->>'responsavel'
    );
  END LOOP;

  FOR v_filial IN SELECT * FROM jsonb_array_elements(p_filiais)
  LOOP
    INSERT INTO public.parceiros_filiais (
      parceiro_id, rotulo, endereco_completo
    ) VALUES (
      p_parceiro_id,
      v_filial->>'rotulo',
      v_filial->>'endereco_completo'
    );
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_passageiro_atomic(p_passageiro_id uuid, p_nome_completo text, p_email text, p_celular text, p_cpf text, p_notificar boolean, p_genero text, p_enderecos jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  -- Atualiza o passageiro
  update public.passageiros
  set
    nome_completo = p_nome_completo,
    email = p_email,
    celular = p_celular,
    cpf = p_cpf,
    notificar = p_notificar,
    genero = p_genero,
    updated_at = now()
  where id = p_passageiro_id;

  -- Remove endereços existentes
  delete from public.passageiro_enderecos
  where passageiro_id = p_passageiro_id;

  -- Insere novos endereços
  insert into public.passageiro_enderecos (passageiro_id, rotulo, endereco_completo, referencia)
  select
    p_passageiro_id,
    (elem->>'rotulo')::text,
    (elem->>'endereco_completo')::text,
    (elem->>'referencia')::text
  from jsonb_array_elements(p_enderecos) as elem;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_pending_whatsapp_messages_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_vehicle_km_odometer_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.update_wmt_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_and_update_vehicle_km(p_veiculo_id uuid, p_os_id uuid, p_km_value numeric, p_km_type text, p_driver_name text DEFAULT NULL::text, p_recorded_via text DEFAULT 'webhook'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_current_km NUMERIC;
  v_current_type TEXT;
BEGIN
  -- 1. Buscar odômetro atual com lock
  SELECT last_km, last_km_type INTO v_current_km, v_current_type
  FROM public.vehicle_km_odometer
  WHERE veiculo_id = p_veiculo_id
  FOR UPDATE;

  -- 2. Validar: novo KM nunca pode ser <= ao último registrado
  IF v_current_km IS NOT NULL AND p_km_value <= v_current_km THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'KM_BELOW_ODOMETER',
      'message', 'O KM informado (' || p_km_value || ') é menor ou igual ao último KM registrado para este veículo (' || v_current_km || '). Verifique o hodômetro.',
      'currentKm', v_current_km,
      'currentKmType', v_current_type,
      'rejectedKm', p_km_value
    );
  END IF;

  -- 3. Inserir ou atualizar odômetro
  INSERT INTO public.vehicle_km_odometer (veiculo_id, last_km, last_km_type, last_os_id, last_recorded_at)
  VALUES (p_veiculo_id, p_km_value, p_km_type, p_os_id, NOW())
  ON CONFLICT (veiculo_id) DO UPDATE SET
    last_km = EXCLUDED.last_km,
    last_km_type = EXCLUDED.last_km_type,
    last_os_id = EXCLUDED.last_os_id,
    last_recorded_at = NOW(),
    updated_at = NOW();

  -- 4. Gravar no histórico
  INSERT INTO public.vehicle_km_history (veiculo_id, os_id, km_value, km_type, driver_name, recorded_via)
  VALUES (p_veiculo_id, p_os_id, p_km_value, p_km_type, p_driver_name, p_recorded_via);

  -- 5. Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'veiculoId', p_veiculo_id,
    'kmValue', p_km_value,
    'kmType', p_km_type,
    'previousKm', v_current_km
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity$function$
;

CREATE OR REPLACE FUNCTION public.word_similarity_commutator_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_commutator_op$function$
;

CREATE OR REPLACE FUNCTION public.word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_dist_commutator_op$function$
;

CREATE OR REPLACE FUNCTION public.word_similarity_dist_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_dist_op$function$
;

CREATE OR REPLACE FUNCTION public.word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_op$function$
;

-- TRIGGERS
CREATE TRIGGER fill_app_notification_author_trigger BEFORE INSERT ON public.app_notifications FOR EACH ROW EXECUTE FUNCTION fill_app_notification_author();
CREATE TRIGGER trg_bancos_updated_at BEFORE UPDATE ON public.bancos FOR EACH ROW EXECUTE FUNCTION set_caixa_updated_at();
CREATE TRIGGER trg_caixa_contas_saldo_init AFTER UPDATE OF saldo_inicial ON public.caixa_contas FOR EACH ROW EXECUTE FUNCTION trigger_caixa_contas_saldo_init();
CREATE TRIGGER trg_caixa_contas_updated_at BEFORE UPDATE ON public.caixa_contas FOR EACH ROW EXECUTE FUNCTION set_caixa_updated_at();
CREATE TRIGGER trg_caixa_lancamentos_saldo AFTER INSERT OR DELETE OR UPDATE ON public.caixa_lancamentos FOR EACH ROW EXECUTE FUNCTION trigger_caixa_recalc_saldo();
CREATE TRIGGER trg_caixa_lancamentos_updated_at BEFORE UPDATE ON public.caixa_lancamentos FOR EACH ROW EXECUTE FUNCTION set_caixa_updated_at();
CREATE TRIGGER on_centro_custo_created AFTER INSERT ON public.centros_custo FOR EACH ROW EXECUTE FUNCTION handle_new_centro_custo_notification();
CREATE TRIGGER trigger_update_conversation_updated_at AFTER INSERT OR UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION update_conversation_updated_at();
CREATE TRIGGER on_cliente_created AFTER INSERT ON public.clientes FOR EACH ROW EXECUTE FUNCTION handle_new_cliente_notification();
CREATE TRIGGER notify_docagem_instance_status_trigger AFTER UPDATE OF status ON public.docagem_instancias FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION handle_docagem_instance_status_notification();
CREATE TRIGGER trg_docagem_pendencias_delete AFTER DELETE ON public.docagem_instancias FOR EACH ROW EXECUTE FUNCTION trigger_docagem_pendencias();
CREATE TRIGGER trg_docagem_pendencias_insert AFTER INSERT ON public.docagem_instancias FOR EACH ROW EXECUTE FUNCTION trigger_docagem_pendencias();
CREATE TRIGGER trg_docagem_pendencias_update AFTER UPDATE ON public.docagem_instancias FOR EACH ROW EXECUTE FUNCTION trigger_docagem_pendencias();
CREATE TRIGGER notify_docagem_cancelled_trigger AFTER UPDATE OF status ON public.docagens FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION handle_docagem_cancelled_notification();
CREATE TRIGGER notify_docagem_created_trigger AFTER INSERT ON public.docagens FOR EACH ROW EXECUTE FUNCTION handle_docagem_created_notification();
CREATE TRIGGER trg_generate_docagem_protocolo BEFORE INSERT ON public.docagens FOR EACH ROW WHEN (((new.protocolo IS NULL) OR (new.protocolo = ''::text))) EXECUTE FUNCTION generate_docagem_protocolo();
CREATE TRIGGER update_driver_vehicles_updated_at BEFORE UPDATE ON public.driver_vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER driver_update_notify AFTER UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION handle_driver_update_notification();
CREATE TRIGGER normalize_driver_phone BEFORE INSERT OR UPDATE OF phone ON public.drivers FOR EACH ROW EXECUTE FUNCTION normalize_driver_phone_trigger();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER on_os_created AFTER INSERT ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION handle_new_os_notification();
CREATE TRIGGER trg_caixa_espelhar_recebimento AFTER UPDATE ON public.ordens_servico FOR EACH ROW WHEN ((new.status_financeiro IS DISTINCT FROM old.status_financeiro)) EXECUTE FUNCTION trigger_caixa_espelhar_recebimento();
CREATE TRIGGER trg_caixa_espelhar_repasse AFTER UPDATE ON public.ordens_servico FOR EACH ROW WHEN ((new.repasse_pago IS DISTINCT FROM old.repasse_pago)) EXECUTE FUNCTION trigger_caixa_espelhar_repasse();
CREATE TRIGGER trg_generate_protocolo BEFORE INSERT ON public.ordens_servico FOR EACH ROW WHEN (((new.protocolo IS NULL) OR (new.protocolo = ''::text))) EXECUTE FUNCTION generate_protocolo();
CREATE TRIGGER trg_os_pendencias_delete AFTER DELETE ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION trigger_os_pendencias();
CREATE TRIGGER trg_os_pendencias_insert AFTER INSERT ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION trigger_os_pendencias();
CREATE TRIGGER trg_os_pendencias_update AFTER UPDATE ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION trigger_os_pendencias();
CREATE TRIGGER trg_update_updated_at BEFORE UPDATE ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER notify_os_log_insert_trigger AFTER INSERT ON public.os_logs FOR EACH ROW EXECUTE FUNCTION handle_os_log_notification();
CREATE TRIGGER set_os_operational_cycles_updated_at_trigger BEFORE UPDATE ON public.os_operational_cycles FOR EACH ROW EXECUTE FUNCTION set_os_operational_cycles_updated_at();
CREATE TRIGGER trg_waypoint_pendencias_delete AFTER DELETE ON public.os_waypoints FOR EACH ROW EXECUTE FUNCTION trigger_waypoint_pendencias();
CREATE TRIGGER trg_waypoint_pendencias_insert AFTER INSERT ON public.os_waypoints FOR EACH ROW EXECUTE FUNCTION trigger_waypoint_pendencias();
CREATE TRIGGER trg_waypoint_pendencias_update AFTER UPDATE ON public.os_waypoints FOR EACH ROW EXECUTE FUNCTION trigger_waypoint_pendencias();
CREATE TRIGGER handle_parceiros_contatos_updated_at BEFORE UPDATE ON public.parceiros_contatos FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER normalize_parceiro_contato_celular BEFORE INSERT OR UPDATE OF celular ON public.parceiros_contatos FOR EACH ROW EXECUTE FUNCTION normalize_parceiro_contato_celular_trigger();
CREATE TRIGGER handle_parceiros_filiais_updated_at BEFORE UPDATE ON public.parceiros_filiais FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER normalize_parceiro_telefone BEFORE INSERT OR UPDATE OF telefone ON public.parceiros_servico FOR EACH ROW EXECUTE FUNCTION normalize_parceiro_telefone_trigger();
CREATE TRIGGER update_parceiros_updated_at BEFORE UPDATE ON public.parceiros_servico FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER normalize_passageiro_celular BEFORE INSERT OR UPDATE OF celular ON public.passageiros FOR EACH ROW EXECUTE FUNCTION normalize_passageiro_celular_trigger();
CREATE TRIGGER trigger_update_pending_whatsapp_messages_updated_at BEFORE UPDATE ON public.pending_whatsapp_messages FOR EACH ROW EXECUTE FUNCTION update_pending_whatsapp_messages_updated_at();
CREATE TRIGGER system_announcements_updated_at BEFORE UPDATE ON public.system_announcements FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_vehicle_km_odometer_updated_at BEFORE UPDATE ON public.vehicle_km_odometer FOR EACH ROW EXECUTE FUNCTION update_vehicle_km_odometer_updated_at();
CREATE TRIGGER update_veiculos_updated_at BEFORE UPDATE ON public.veiculos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_wmt_updated_at BEFORE UPDATE ON public.whatsapp_message_tracking FOR EACH ROW EXECUTE FUNCTION update_wmt_updated_at();

-- RLS
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications_sistema_backup_20260614 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bancos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixa_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixa_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docagem_instancias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docagem_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_config_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frontend_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_cycle_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_driver_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_financeiro_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_link_shortcuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_logs_sistema_backup_20260614 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_operational_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_passenger_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_waypoint_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_waypoint_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros_filiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passageiro_enderecos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passageiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_pendencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_km_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_km_odometer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_flow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_status ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "Users can delete own dismissals" ON public.announcement_dismissals AS PERMISSIVE FOR DELETE TO public USING (((auth.role() = 'authenticated'::text) AND (user_id = auth.uid())));
CREATE POLICY "Users can insert own dismissals" ON public.announcement_dismissals AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.role() = 'authenticated'::text) AND (user_id = auth.uid())));
CREATE POLICY "Users can read own dismissals" ON public.announcement_dismissals AS PERMISSIVE FOR SELECT TO public USING (((auth.role() = 'authenticated'::text) AND (user_id = auth.uid())));
CREATE POLICY "Usuários podem deletar suas próprias leituras" ON public.app_notification_reads AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Usuários podem inserir suas próprias leituras" ON public.app_notification_reads AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Usuários veem apenas suas próprias leituras" ON public.app_notification_reads AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Gestores veem mensagens 'gestor' e 'all'" ON public.app_notifications AS PERMISSIVE FOR SELECT TO public USING (((target_audience = ANY (ARRAY['gestor'::text, 'all'::text])) AND (auth.uid() IN ( SELECT user_roles.id
   FROM user_roles
  WHERE (user_roles.tipo_usuario = 'gestor'::text))) AND ((target_user_id = auth.uid()) OR (empresa_id IS NULL) OR (empresa_id IN ( SELECT user_roles.empresa_id
   FROM user_roles
  WHERE (user_roles.id = auth.uid()))))));
CREATE POLICY "Internos veem mensagens 'interno' e 'all'" ON public.app_notifications AS PERMISSIVE FOR SELECT TO public USING (((target_audience = ANY (ARRAY['interno'::text, 'all'::text])) AND (auth.uid() IN ( SELECT user_roles.id
   FROM user_roles
  WHERE (user_roles.tipo_usuario = 'interno'::text)))));
CREATE POLICY app_settings_insert_authenticated ON public.app_settings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY app_settings_select_authenticated ON public.app_settings AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY app_settings_update_authenticated ON public.app_settings AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY app_settings_write_service_role ON public.app_settings AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can read app_versions" ON public.app_versions AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Only admins can insert app_versions" ON public.app_versions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.id = auth.uid()) AND (user_roles.categoria = 'administrador'::text)))));
CREATE POLICY bancos_read_authenticated ON public.bancos AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY caixa_contas_read_authenticated ON public.caixa_contas AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY caixa_contas_write_service ON public.caixa_contas AS PERMISSIVE FOR ALL TO public USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY caixa_lancamentos_read_authenticated ON public.caixa_lancamentos AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY caixa_lancamentos_write_service ON public.caixa_lancamentos AS PERMISSIVE FOR ALL TO public USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY centros_custo_auth_all ON public.centros_custo AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on conversations" ON public.chat_conversations AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can create conversations" ON public.chat_conversations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));
CREATE POLICY "Users can view conversations they participate in" ON public.chat_conversations AS PERMISSIVE FOR SELECT TO authenticated USING (((created_by = auth.uid()) OR is_chat_conversation_member(id, auth.uid())));
CREATE POLICY "Service role full access on messages" ON public.chat_messages AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can edit their own messages" ON public.chat_messages AS PERMISSIVE FOR UPDATE TO authenticated USING ((sender_id = auth.uid())) WITH CHECK ((sender_id = auth.uid()));
CREATE POLICY "Users can send messages in their conversations" ON public.chat_messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND is_chat_conversation_member(conversation_id, auth.uid())));
CREATE POLICY "Users can view messages in their conversations" ON public.chat_messages AS PERMISSIVE FOR SELECT TO authenticated USING (is_chat_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Service role full access on participants" ON public.chat_participants AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can add participants to conversations they created" ON public.chat_participants AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM chat_conversations c
  WHERE ((c.id = chat_participants.conversation_id) AND (c.created_by = auth.uid())))));
CREATE POLICY "Users can update their own participant data" ON public.chat_participants AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view participants in their conversations" ON public.chat_participants AS PERMISSIVE FOR SELECT TO authenticated USING (is_chat_conversation_member(conversation_id, auth.uid()));
CREATE POLICY clientes_auth_all ON public.clientes AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete docagem_instancias to authenticated" ON public.docagem_instancias AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow insert docagem_instancias to authenticated" ON public.docagem_instancias AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow select docagem_instancias to authenticated" ON public.docagem_instancias AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update docagem_instancias to authenticated" ON public.docagem_instancias AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete docagem_lancamentos to authenticated" ON public.docagem_lancamentos AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow insert docagem_lancamentos to authenticated" ON public.docagem_lancamentos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow select docagem_lancamentos to authenticated" ON public.docagem_lancamentos AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update docagem_lancamentos to authenticated" ON public.docagem_lancamentos AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete docagens to authenticated" ON public.docagens AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow insert docagens to authenticated" ON public.docagens AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow select docagens to authenticated" ON public.docagens AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update docagens to authenticated" ON public.docagens AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users" ON public.driver_documents AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.driver_documents AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable select for authenticated users" ON public.driver_documents AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable update for authenticated users" ON public.driver_documents AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete driver_vehicles" ON public.driver_vehicles AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert driver_vehicles" ON public.driver_vehicles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to select driver_vehicles" ON public.driver_vehicles AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update driver_vehicles" ON public.driver_vehicles AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY drivers_auth_all ON public.drivers AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY financial_config_history_insert_authenticated ON public.financial_config_history AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY financial_config_history_select_authenticated ON public.financial_config_history AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY financial_config_history_write_service_role ON public.financial_config_history AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role pode ver todos os logs" ON public.frontend_error_logs AS PERMISSIVE FOR SELECT TO service_role USING (true);
CREATE POLICY "Usuários autenticados podem inserir logs" ON public.frontend_error_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Usuários autenticados podem ver seus próprios logs" ON public.frontend_error_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Service role can insert notifications" ON public.notifications AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Users can update own notifications" ON public.notifications AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY ordens_servico_auth_all ON public.ordens_servico AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.os_driver_polls AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can insert os finance attachments" ON public.os_financeiro_anexos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can read os finance attachments" ON public.os_financeiro_anexos AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all" ON public.os_link_shortcuts AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow insert os_logs to authenticated" ON public.os_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow select os_logs to authenticated" ON public.os_logs AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow delete os_operational_cycles to authenticated" ON public.os_operational_cycles AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow insert os_operational_cycles to authenticated" ON public.os_operational_cycles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow select os_operational_cycles to authenticated" ON public.os_operational_cycles AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update os_operational_cycles to authenticated" ON public.os_operational_cycles AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated insert" ON public.os_passenger_confirmations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON public.os_passenger_confirmations AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read for passenger accept" ON public.os_passenger_confirmations AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Allow service role all" ON public.os_passenger_confirmations AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY os_waypoint_comments_auth_all ON public.os_waypoint_comments AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY os_waypoint_passengers_auth_all ON public.os_waypoint_passengers AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY os_waypoints_auth_all ON public.os_waypoints AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for all authenticated users" ON public.parceiros_contatos AS PERMISSIVE FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Enable insert for all authenticated users" ON public.parceiros_contatos AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "Enable read access for all authenticated users" ON public.parceiros_contatos AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Enable update for all authenticated users" ON public.parceiros_contatos AS PERMISSIVE FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Enable delete for all authenticated users" ON public.parceiros_filiais AS PERMISSIVE FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Enable insert for all authenticated users" ON public.parceiros_filiais AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "Enable read access for all authenticated users" ON public.parceiros_filiais AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Enable update for all authenticated users" ON public.parceiros_filiais AS PERMISSIVE FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY parceiros_delete_authenticated ON public.parceiros_servico AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY parceiros_insert_authenticated ON public.parceiros_servico AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY parceiros_select_all ON public.parceiros_servico AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY parceiros_update_authenticated ON public.parceiros_servico AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY passageiro_enderecos_auth_all ON public.passageiro_enderecos AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY passageiros_auth_all ON public.passageiros AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on pending_whatsapp_messages" ON public.pending_whatsapp_messages AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY solicitantes_auth_all ON public.solicitantes AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Administrators can delete announcements" ON public.system_announcements AS PERMISSIVE FOR DELETE TO public USING (((auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.id = auth.uid()) AND (user_roles.categoria = 'administrador'::text))))));
CREATE POLICY "Administrators can insert announcements" ON public.system_announcements AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.id = auth.uid()) AND (user_roles.categoria = 'administrador'::text))))));
CREATE POLICY "Administrators can update announcements" ON public.system_announcements AS PERMISSIVE FOR UPDATE TO public USING (((auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.id = auth.uid()) AND (user_roles.categoria = 'administrador'::text))))));
CREATE POLICY "Authenticated users can read active announcements" ON public.system_announcements AS PERMISSIVE FOR SELECT TO public USING (((auth.role() = 'authenticated'::text) AND (is_active = true)));
CREATE POLICY system_pendencias_read_all ON public.system_pendencias AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY system_pendencias_write_service ON public.system_pendencias AS PERMISSIVE FOR ALL TO public USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Authenticated users can view all presence" ON public.user_presence AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access on presence" ON public.user_presence AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can update own presence" ON public.user_presence AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Authenticated users can read user_roles for chat" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access on user_roles" ON public.user_roles AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can read own user_role" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((id = auth.uid()));
CREATE POLICY "Usuários podem ler seus próprios perfis" ON public.user_roles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
CREATE POLICY "Authenticated read vehicle_km_history" ON public.vehicle_km_history AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access on vehicle_km_history" ON public.vehicle_km_history AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read vehicle_km_odometer" ON public.vehicle_km_odometer AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access on vehicle_km_odometer" ON public.vehicle_km_odometer AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY veiculos_delete_authenticated ON public.veiculos AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY veiculos_insert_authenticated ON public.veiculos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY veiculos_select_all ON public.veiculos AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY veiculos_update_authenticated ON public.veiculos AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on webhook_flow_events" ON public.webhook_flow_events AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON public.webhook_logs AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY webhook_logs_insert ON public.webhook_logs AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY webhook_logs_select ON public.webhook_logs AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Service role full access on webhook_metrics" ON public.webhook_metrics AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on webhook_rate_limits" ON public.webhook_rate_limits AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on whatsapp_message_tracking" ON public.whatsapp_message_tracking AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY whatsapp_status_select ON public.whatsapp_status AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY whatsapp_status_service_insert ON public.whatsapp_status AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY whatsapp_status_service_update ON public.whatsapp_status AS PERMISSIVE FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- COMPLEMENTOS CAPTURADOS VIA MCP (2026-08-12)
-- Partes que nao estavam no dump de catalogo do schema public.
-- ============================================================

-- REALTIME (publication supabase_realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_versions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.caixa_contas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.caixa_lancamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.centros_custo;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordens_servico;
ALTER PUBLICATION supabase_realtime ADD TABLE public.os_operational_cycles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.os_passenger_confirmations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.os_waypoints;
ALTER PUBLICATION supabase_realtime ADD TABLE public.passageiros;
ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitantes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_pendencias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_status;

-- TRIGGER FORA DO SCHEMA public
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- CRON JOBS (pg_cron)
SELECT cron.schedule('cleanup-old-logs',       '0 3 * * *',     'SELECT delete_old_logs();');
SELECT cron.schedule('reconcile-pendencias',   '*/15 * * * *',  'SELECT public.reconcile_all_pendencias();');
SELECT cron.schedule('cleanup-webhook-logs',   '30 3 * * *',    $$DELETE FROM public.webhook_logs WHERE created_at < now() - interval '7 days'$$);
SELECT cron.schedule('cleanup-frontend-logs',  '0 3 * * *',     $$DELETE FROM public.frontend_error_logs WHERE created_at < now() - interval '7 days'$$);

-- STORAGE BUCKETS (referencia)
-- driver-docs             public = true
-- financeiro-comprovantes public = false
-- profile-images          public = true

-- SEQUENCE (valor no momento do snapshot)
-- public.protocolo_seq last_value = 3447
