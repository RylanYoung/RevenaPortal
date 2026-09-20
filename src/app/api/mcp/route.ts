import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { TOOLS, callTool } from "@/lib/mcp-tools";

/**
 * "Revena Admin" — remote MCP server.
 *
 * Speaks MCP's JSON-RPC 2.0 over HTTP POST (Streamable HTTP), statelessly:
 * every request carries its own auth and nothing is held between calls, which
 * is what lets it run on Vercel's serverless functions without a session store.
 *
 * Auth is a single admin-scoped bearer token (MCP_API_KEY) — NOT client RLS.
 * Anything reaching this endpoint can read and write every client's data.
 */

export const runtime = "nodejs";

const PROTOCOL_VERSION = "2025-06-18";

function matches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  // Hash first so timingSafeEqual always gets equal-length buffers.
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Accepts the key from the URL as well as the Authorization header.
 *
 * The query param exists because Claude's custom-connector flow treats a 401
 * as "this server speaks OAuth" and shows a Sign in button that goes nowhere —
 * there is no OAuth server here. Putting the key in the connector URL means
 * requests are authorised from the first byte, so that never triggers.
 */
function authorized(request: NextRequest): boolean {
  const expected = process.env.MCP_API_KEY;
  if (!expected) return false; // Fail closed — unset must not mean open.

  const fromQuery = request.nextUrl.searchParams.get("key");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return matches(fromQuery, expected) || matches(bearer ?? null, expected);
}

type RpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

function result(id: RpcRequest["id"], value: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result: value });
}

function rpcError(id: RpcRequest["id"], code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
      { status: 401 }
    );
  }

  let body: RpcRequest;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const { method, id } = body;

  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "Revena Admin", version: "1.0.0" },
      });

    // Notifications carry no id and expect no result body.
    case "notifications/initialized":
    case "notifications/cancelled":
      return new Response(null, { status: 202 });

    case "ping":
      return result(id, {});

    case "tools/list":
      return result(id, { tools: TOOLS });

    case "tools/call": {
      const name = body.params?.name;
      const args = (body.params?.arguments ?? {}) as Record<string, unknown>;

      if (typeof name !== "string") {
        return rpcError(id, -32602, "Missing tool name");
      }

      try {
        const text = await callTool(name, args);
        return result(id, { content: [{ type: "text", text }] });
      } catch (error) {
        // Surfaced as a tool result rather than a transport error, so Claude
        // can read what went wrong and tell Rylan instead of just failing.
        return result(id, {
          content: [
            {
              type: "text",
              text: `That didn't work: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        });
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

/** Lets you confirm the endpoint is live and authenticating. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    name: "Revena Admin",
    protocolVersion: PROTOCOL_VERSION,
    tools: TOOLS.map((t) => t.name),
  });
}
