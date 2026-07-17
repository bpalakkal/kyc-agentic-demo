import { useAgentRegistry } from "@/hooks/useAgentRegistry";

const CATEGORY_ORDER = ["sourcing", "due_diligence", "screening"];

const CATEGORY_LABELS: Record<string, string> = {
  sourcing:      "Sourcing",
  due_diligence: "Due Diligence",
  screening:     "Screening",
};

export default function Agents() {
  const { data: agents = [], isLoading, isError } = useAgentRegistry();

  const sorted = [...agents].sort((a, b) => {
    const ci = CATEGORY_ORDER.indexOf(a.category ?? "") - CATEGORY_ORDER.indexOf(b.category ?? "");
    if (ci !== 0) return ci;
    return a.display_name.localeCompare(b.display_name);
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent Registry</h1>
        <p className="text-sm text-gray-500 mt-1">Live registry — {agents.length} agents</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Loading agents…
        </div>
      )}

      {isError && (
        <div className="text-sm text-red-500 bg-red-50 rounded-lg p-4">
          Failed to load agent registry. Is the server running?
        </div>
      )}

      {!isLoading && !isError && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name", "Slug", "Category", "CIP", "Jurisdiction", "Runner", "Output", "Status"].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((agent) => (
                <tr key={agent.slug} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{agent.display_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{agent.slug}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {CATEGORY_LABELS[agent.category ?? ""] ?? agent.category ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{agent.cip_classification ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{agent.jurisdiction ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{agent.runner_type ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{agent.output_type ?? "—"}</td>
                  <td className="px-4 py-3">
                    {agent.enabled !== false ? (
                      <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Enabled
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                        Disabled
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
