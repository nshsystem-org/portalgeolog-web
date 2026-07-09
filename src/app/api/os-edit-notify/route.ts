import { NextRequest, NextResponse } from "next/server";
import { notifyDriverOnOSEdit } from "@/lib/os-edit-notifications";

export const runtime = "nodejs";

/**
 * API route para notificar motorista quando uma OS é editada.
 *
 * Recebe POST com:
 *   {
 *     osId: string,
 *     previousState: {
 *       driverId?: string | null,
 *       motorista?: string | null,
 *       data?: string | null,
 *       hora?: string | null,
 *       waypoints?: Array<{ label, hora, data, itineraryIndex }>
 *     }
 *   }
 *
 * A API compara o estado anterior com o estado atual no banco e envia:
 *   - cancelamento_viagem_motorista ao motorista antigo (se motorista trocado)
 *   - appointment_scheduling ao motorista novo (se motorista trocado)
 *   - alteracao_viagem_motorista ao motorista atual (se horário/endereço mudou)
 *
 * A detecção de horário compara data/hora de cada waypoint individualmente
 * (incluindo retornos e itinerários secundários), não apenas os campos da OS.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { osId, previousState } = body as {
      osId?: string;
      previousState?: {
        driverId?: string | null;
        motorista?: string | null;
        data?: string | null;
        hora?: string | null;
        waypoints?: Array<{
          label: string;
          hora?: string | null;
          data?: string | null;
          itineraryIndex?: number | null;
        }>;
      };
    };

    if (!osId) {
      return NextResponse.json(
        { error: "osId é obrigatório" },
        { status: 400 },
      );
    }

    if (!previousState) {
      return NextResponse.json(
        { error: "previousState é obrigatório" },
        { status: 400 },
      );
    }

    const result = await notifyDriverOnOSEdit(osId, previousState);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[api/os-edit-notify] Erro:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
