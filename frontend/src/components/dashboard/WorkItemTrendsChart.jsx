import React from "react";
import ReactECharts from "echarts-for-react";

export default function WorkItemTrendsChart({ data }) {
  const option = {
    title: { text: "WorkItem Trends (7 days)", left: "center" },
    tooltip: { trigger: "axis" },
    legend: { data: ["P1", "P2"], bottom: 0 },
    xAxis: { type: "category", data: data.map((d) => d.date) },
    yAxis: { type: "value" },
    series: [
      {
        name: "P1",
        type: "line",
        data: data.map((d) => d.p1),
        lineStyle: { color: "red" },
      },
      {
        name: "P2",
        type: "line",
        data: data.map((d) => d.p2),
        lineStyle: { color: "orange" },
      },
    ],
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-900 rounded shadow">
      <ReactECharts option={option} style={{ height: "300px" }} />
    </div>
  );
}
