import { createClient } from "@supabase/supabase-js";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Phone,
  Route,
  User,
} from "lucide-react";
import { CopyableText } from "@/components/CopyableText";
import PassengerConfirmButton from "@/components/passenger/PassengerConfirmButton";

export const runtime = "edge";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface PageProps {
  params: { token: string };
}

interface WaypointRow {
  id: string;
  label: string;
  comment?: string | null;
  itinerary_index?: number | null;
  hora?: string | null;
  data?: string | null;
  position?: number | null;
}

interface ItineraryGroup {
  index: number;
  firstPosition: number;
  waypoints: WaypointRow[];
}

const formatDate = (value?: string | null): string => {
  if (!value) return "Não informado";
  if (value.includes("/")) return value;

  const parts = value.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
  }

  return value;
};

const formatTime = (value?: string | null): string => {
  if (!value) return "Não informado";
  return value.slice(0, 5);
};

const formatDateTime = (date?: string | null, time?: string | null): string => {
  const formattedDate = formatDate(date);
  const formattedTime = formatTime(time);

  if (formattedDate === "Não informado" && formattedTime === "Não informado") {
    return "Não informado";
  }

  if (formattedDate === "Não informado") {
    return formattedTime;
  }

  if (formattedTime === "Não informado") {
    return formattedDate;
  }

  return `${formattedDate} - ${formattedTime}`;
};

const groupWaypoints = (waypoints: WaypointRow[]): ItineraryGroup[] => {
  const groups = new Map<number, ItineraryGroup>();

  waypoints.forEach((waypoint, index) => {
    const itineraryIndex = waypoint.itinerary_index ?? 0;
    if (!groups.has(itineraryIndex)) {
      groups.set(itineraryIndex, {
        index: itineraryIndex,
        firstPosition: index,
        waypoints: [],
      });
    }

    const group = groups.get(itineraryIndex);
    if (!group) return;

    group.waypoints.push(waypoint);
    if (
      typeof waypoint.position === "number" &&
      waypoint.position < group.firstPosition
    ) {
      group.firstPosition = waypoint.position;
    }
  });

  return Array.from(groups.values()).sort(
    (a, b) => a.firstPosition - b.firstPosition,
  );
};

const normalizeName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const escapeLikePattern = (value: string): string =>
  value.replace(/[\\%_]/g, "\\$&");

export default async function PassengerShortLinkPage({
  params,
}: PageProps): Promise<JSX.Element> {
  const { token } = params;
  const supabase = createAdminClient();

  const { data: shortcut } = await supabase
    .from("os_link_shortcuts")
    .select("os_id")
    .eq("slug", token)
    .eq("type", "passenger")
    .maybeSingle();

  const resolvedToken = shortcut?.os_id || token;

  const { data: confirmation } = await supabase
    .from("os_passenger_confirmations")
    .select("id, os_id, passageiro_id, aceito, aceito_em")
    .eq("token", resolvedToken)
    .maybeSingle();

  if (!confirmation?.id) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <AlertCircle size={32} className="text-red-600" />
          </div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider">
            Link inválido
          </h1>
          <p className="text-sm font-semibold text-slate-500">
            Não foi possível localizar os dados desta viagem.
          </p>
        </div>
      </div>
    );
  }

  const { data: os } = await supabase
    .from("ordens_servico")
    .select("id, protocolo, os_number, data, hora, motorista, veiculo_id")
    .eq("id", confirmation.os_id)
    .maybeSingle();

  if (!os) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <AlertCircle size={32} className="text-red-600" />
          </div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider">
            Ordem de serviço não encontrada
          </h1>
          <p className="text-sm font-semibold text-slate-500">
            Os dados da viagem não estão mais disponíveis.
          </p>
        </div>
      </div>
    );
  }

  let driverName = os.motorista || "Não informado";
  let driverPhone = "Não informado";
  let vehicleLabel = "Não informado";
  let vehiclePlate = "Não informado";
  let passengerName = "Passageiro";
  let waypoints: WaypointRow[] = [];

  if (os.motorista) {
    const motoristaNormalized = normalizeName(os.motorista);
    const { data: driverCandidates } = await supabase
      .from("drivers")
      .select("name, phone")
      .ilike("name", `%${escapeLikePattern(os.motorista.trim())}%`)
      .limit(10);

    const matchedDriver =
      driverCandidates?.find(
        (candidate) =>
          normalizeName(candidate.name || "") === motoristaNormalized,
      ) ||
      driverCandidates?.find((candidate) =>
        normalizeName(candidate.name || "").includes(motoristaNormalized),
      );

    if (matchedDriver) {
      driverName = matchedDriver.name || driverName;
      driverPhone = matchedDriver.phone || driverPhone;
    }
  }

  if (os.veiculo_id) {
    const { data: vehicleData } = await supabase
      .from("veiculos")
      .select("marca, modelo, placa")
      .eq("id", os.veiculo_id)
      .maybeSingle();

    if (vehicleData) {
      const parts = [vehicleData.marca, vehicleData.modelo]
        .filter(Boolean)
        .map(String);
      vehicleLabel = parts.length > 0 ? parts.join(" ") : "Não informado";
      vehiclePlate = vehicleData.placa || "Não informado";
    }
  }

  if (confirmation.passageiro_id) {
    const { data: passengerData } = await supabase
      .from("passageiros")
      .select("id, nome_completo")
      .eq("id", confirmation.passageiro_id)
      .maybeSingle();

    if (passengerData) {
      passengerName = passengerData.nome_completo || passengerName;
    }
  }

  const { data: waypointData } = await supabase
    .from("os_waypoints")
    .select("id, label, comment, itinerary_index, hora, data, position")
    .eq("ordem_servico_id", os.id)
    .order("position");

  waypoints = (waypointData || []) as WaypointRow[];

  const passengerWaypointIds = new Set<string>();
  if (confirmation.passageiro_id && waypoints.length > 0) {
    const { data: waypointPassengers } = await supabase
      .from("os_waypoint_passengers")
      .select("waypoint_id, passageiro_id")
      .in(
        "waypoint_id",
        waypoints.map((wp) => wp.id),
      )
      .eq("passageiro_id", confirmation.passageiro_id);

    (waypointPassengers || []).forEach((row: Record<string, unknown>) => {
      const waypointId = String(row.waypoint_id || "");
      if (waypointId) {
        passengerWaypointIds.add(waypointId);
      }
    });
  }

  const itineraryGroups = groupWaypoints(waypoints);
  const passengerItineraryGroups = itineraryGroups
    .filter((group) =>
      group.waypoints.some((waypoint) => passengerWaypointIds.has(waypoint.id)),
    )
    .sort((a, b) => a.firstPosition - b.firstPosition);
  const filteredItineraryGroups =
    passengerItineraryGroups.length > 0 ? [passengerItineraryGroups[0]] : [];
  const osProtocol = os.protocolo || os.os_number || "Viagem";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/40 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                <CalendarDays size={14} />
                Confirmar viagem
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-tight">
                  <span className="text-sm sm:text-base font-semibold text-slate-500 normal-case tracking-normal">
                    Protocolo:{" "}
                  </span>
                  <span className="text-slate-900">{osProtocol}</span>
                </h1>
                <p className="text-sm sm:text-base font-semibold text-slate-500">
                  Confira endereço, itinerários, motorista e veículo antes de
                  confirmar.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Route size={22} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Data da viagem
                </p>
                <p className="text-sm font-black text-slate-800">
                  {formatDateTime(os.data, os.hora)}
                </p>
              </div>
            </div>
          </div>

          {confirmation.aceito && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3 text-emerald-700">
              <CheckCircle2 size={18} />
              <p className="text-sm font-bold">
                Viagem já confirmada em{" "}
                {confirmation.aceito_em
                  ? formatDateTime(
                      confirmation.aceito_em.slice(0, 10),
                      confirmation.aceito_em.slice(11, 16),
                    )
                  : "momento anterior"}
                .
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <User size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Passageiro
                  </p>
                  <p className="text-lg font-black text-slate-900">
                    {passengerName}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Motorista
                  </p>
                  <p className="text-sm font-black text-slate-800">
                    {driverName}
                  </p>
                  <div className="flex items-center gap-2 text-base font-semibold text-slate-600">
                    <Phone size={16} className="text-slate-400 shrink-0" />
                    {driverPhone !== "Não informado" ? (
                      <CopyableText
                        text={driverPhone}
                        className="text-slate-600"
                      >
                        {driverPhone}
                      </CopyableText>
                    ) : (
                      <span>{driverPhone}</span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Veículo
                  </p>
                  <p className="text-sm font-black text-slate-800">
                    {vehicleLabel}
                  </p>
                  <p className="text-base font-semibold text-slate-600">
                    Placa:{" "}
                    {vehiclePlate !== "Não informado" ? (
                      <CopyableText
                        text={vehiclePlate}
                        className="text-slate-600"
                      >
                        {vehiclePlate}
                      </CopyableText>
                    ) : (
                      <span>{vehiclePlate}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-rose-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Itinerário completo
                  </p>
                </div>

                <p className="text-sm font-semibold text-slate-500">
                  Consulte os detalhes do trajeto abaixo.
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Confirmação
                  </p>
                  <p className="text-lg font-black text-slate-900">
                    Revise antes de confirmar
                  </p>
                </div>
              </div>

              <p className="text-sm font-semibold text-slate-500">
                Ao confirmar, você informa que conferiu os dados do trajeto e do
                atendimento.
              </p>

              <PassengerConfirmButton
                token={resolvedToken}
                alreadyAccepted={!!confirmation.aceito}
              />
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <Route size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Itinerários
                </p>
                <p className="text-lg font-black text-slate-900">
                  Trajeto da viagem
                </p>
              </div>
            </div>

            {filteredItineraryGroups.length > 0 ? (
              <div className="space-y-4">
                {filteredItineraryGroups.map((group) => {
                  const firstWaypoint = group.waypoints[0];
                  const itineraryTitle =
                    group.index < 0
                      ? "Retorno"
                      : `Itinerário ${group.index + 1}`;
                  const itineraryDateTime = formatDateTime(
                    firstWaypoint?.data || os.data,
                    firstWaypoint?.hora || os.hora,
                  );
                  return (
                    <div
                      key={group.index}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                            {itineraryTitle}
                          </p>
                          <p className="text-sm font-black text-slate-900">
                            {itineraryDateTime}
                          </p>
                        </div>
                        {group.waypoints.some((waypoint) =>
                          passengerWaypointIds.has(waypoint.id),
                        ) && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                            <MapPin size={11} />
                            Itinerário completo
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {group.waypoints.map((waypoint) => (
                          <div
                            key={waypoint.id}
                            className="rounded-xl border border-white bg-white p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-black text-slate-800">
                                  {waypoint.label}
                                </p>
                                {waypoint.comment && (
                                  <p className="text-xs font-semibold text-slate-500 italic">
                                    {waypoint.comment}
                                  </p>
                                )}
                              </div>
                              <p className="text-xs font-black text-slate-400">
                                {formatDateTime(
                                  waypoint.data || os.data,
                                  waypoint.hora || os.hora,
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm font-semibold text-slate-500">
                Nenhum itinerário vinculado a este passageiro foi encontrado
                para esta viagem.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
