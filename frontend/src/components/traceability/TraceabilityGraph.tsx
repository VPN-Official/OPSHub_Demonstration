import React, { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { resolveTraceability } from "../utils/traceability";

interface TraceabilityGraphProps {
  entityType: string;
  id: string;
}

export const TraceabilityGraph: React.FC<TraceabilityGraphProps> = ({
  entityType,
  id,
}) => {
  const [currentEntity, setCurrentEntity] = useState<{ type: string; id: string }>({
    type: entityType,
    id,
  });
  const [breadcrumbs, setBreadcrumbs] = useState<
    { type: string; id: string; label: string }[]
  >([]);
  const [option, setOption] = useState<any>(null);

  const buildGraph = async (entityType: string, id: string) => {
    const related = await resolveTraceability(entityType as any, id);

    const nodes: any[] = [
      {
        id,
        name: `${entityType}:${id}`,
        category: entityType,
        symbolSize: 70,
      },
    ];
    const links: any[] = [];

    Object.entries(related).forEach(([relType, items]) => {
      items.forEach((item: any) => {
        if (!item) return;
        nodes.push({
          id: item.id,
          name: item.title || item.name || item.id,
          category: relType,
          symbolSize: 50,
          entityType: relType,
        });
        links.push({
          source: id,
          target: item.id,
          label: { show: true, formatter: relType },
        });
      });
    });

    const categories = [
      entityType,
      ...Object.keys(related),
    ].map((cat) => ({ name: cat }));

    setOption({
      tooltip: { trigger: "item" },
      legend: [{ data: categories.map((c) => c.name) }],
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          draggable: true,
          label: { show: true, position: "right" },
          force: { repulsion: 250, edgeLength: 120 },
          data: nodes,
          links,
          categories,
        },
      ],
    });
  };

  useEffect(() => {
    buildGraph(currentEntity.type, currentEntity.id);
  }, [currentEntity]);

  const handleEvents = {
    click: (params: any) => {
      if (params.data && params.data.entityType) {
        setBreadcrumbs((prev) => [
          ...prev,
          {
            type: currentEntity.type,
            id: currentEntity.id,
            label: `${currentEntity.type}:${currentEntity.id}`,
          },
        ]);
        setCurrentEntity({ type: params.data.entityType, id: params.data.id });
      }
    },
  };

  return (
    <div className="w-full">
      {/* Breadcrumb Navigation */}
      {breadcrumbs.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 text-sm">
          {breadcrumbs.map((b, idx) => (
            <button
              key={idx}
              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={() => {
                setCurrentEntity({ type: b.type, id: b.id });
                setBreadcrumbs(breadcrumbs.slice(0, idx));
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      {/* ECharts Graph */}
      {option ? (
        <ReactECharts
          option={option}
          style={{ height: "600px", width: "100%" }}
          onEvents={handleEvents}
        />
      ) : (
        <div>Loading graph...</div>
      )}
    </div>
  );
};